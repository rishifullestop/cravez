import { ObjectId } from 'mongodb';
import clone from 'clone';
import  geolib from 'geolib';
import {parallel as asyncParallel, eachOfSeries, series as asyncSeries} from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from "../../../../utils/index.mjs";

import distance from '../../../../vendor/google-distance/index.js';
distance.apiKey = 	Constants.DISTANCE_GOOGLE_API;

export default class Assignment {

	constructor(db) {
        this.db = db;
	}

	/**
	Site Settings:
		--
		Auto Assignment Process
		Order_Assignment.assignment_process

		Request Accept time for captain (In Seconds)
		Order_Assignment.request_accept_time
		-
		Max number of order assigned to a captain (In Minutes)
		Order_Assignment.max_order_assigned_to_captain
		-
		Assignment Buffer time (In Minutes)
		Order_Assignment.assignment_buffer_time
		-
		Assignment Maximum buffer time (In Minutes)
		Order_Assignment.maximum_buffer_time
		suppose 30 minutes is max buffer time then, If preparation time is 30 minutes but no captain available in 30 minutes then 30 min. max buffer time will be added in preparation time and now system find for a captain who is available in 31 min., then 32,33,34.....60 minutes(30 preparation time+30 max buffer time)
		-
		Near By Restaurants Distance in minutes (In Minutes)
		Order_Assignment.near_by_restaurant_distance_in_minutes
		-
		Bike Max distance (In KM)
		Order_Assignment.bike_max_distance
		-
		Car Max distance (In KM)
		Order_Assignment.car_max_distance
	*/

	/**
	 * Function to assign captain for order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As option Data
	 *
	 * @return json
	**/
	assignCaptainForOrder (req,res,next,options){
		return new Promise(resolve=>{
			const requestAcceptTime	= (res.locals.settings['Order_Assignment.request_accept_time']) ? parseInt(res.locals.settings['Order_Assignment.request_accept_time']) :0;
			const maxOrderAssigned	= (res.locals.settings['Order_Assignment.max_order_assigned_to_captain']) ? parseInt(res.locals.settings['Order_Assignment.max_order_assigned_to_captain']) :0;
			const users 				= this.db.collection(Tables.USERS);
			const orders 				= this.db.collection(Tables.ORDERS);
			const order_assignment_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);

			/** Send error response */
			if(!options.order_id || !options.restaurant_id || !options.branch_id || !options.delivery_area_id || !options.area_id || !options.captain_id || !options.customer_id) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			let orderId 			= 	new ObjectId(options.order_id);
			let restaurantId		= 	new ObjectId(options.restaurant_id);
			let branchId			= 	new ObjectId(options.branch_id);
			let deliveryAreaId		= 	new ObjectId(options.delivery_area_id);
			let areaId				= 	new ObjectId(options.area_id);
			let captainId			= 	new ObjectId(options.captain_id);
			let customerId			= 	new ObjectId(options.customer_id);
			let assignmentType		= 	(options.assignment_type) 		? 	options.assignment_type 				:Constants.AUTOMATIC_ASSIGNMENT;
			let assignedBy			= 	(options.assigned_by) 			? 	new ObjectId(options.assigned_by) 		:"";
			let restaurantLatitude	= 	(options.restaurant_latitude) 	? 	parseFloat(options.restaurant_latitude) :"";
			let restaurantLongitude	=	(options.restaurant_longitude) 	? 	parseFloat(options.restaurant_longitude):"";
			let timeOfArrival		=	(options.time_of_arrival) 		?	options.time_of_arrival 				:0;
			let timeOfArrivalDate 	= 	Helpers.addDate(timeOfArrival/Constants.MINUTES_IN_A_HOUR);

			asyncParallel({
				remaining_preparation_data : (callback)=>{
					/** Get order remaining preparation delivery duration time  */
					const order_details = this.db.collection(Tables.ORDER_DETAILS);
					order_details.findOne({order_id : orderId },{projection: {remaining_preparation_time:1,remaining_delivery_duration:1}}).then(orderPreparationData=>{
						callback(null,orderPreparationData);
					}).catch(next);
				}
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				if(!asyncResponse.remaining_preparation_data) return resolve({
					status: Constants.STATUS_ERROR,
					message: res.__("system.something_going_wrong_please_try_again"),
					order_not_found: true
				});

				let remainingPreparationTime 	=	parseInt(asyncResponse.remaining_preparation_data.remaining_preparation_time);
				let remainingDeliveryDuration 	= 	parseInt(asyncResponse.remaining_preparation_data.remaining_delivery_duration);
				let cancelledTime				= 	Helpers.addDate(requestAcceptTime/Constants.SECONDS_IN_A_HOUR);

				/** Manage this conditions from global constant */
				let userConditions 		=	clone(Constants.DRIVER_ASSIGNMENT_CONDITIONS);
				userConditions._id  	= 	captainId;
				userConditions["$and"] 	=	[
					{"$or" : [
						{active_orders:	{$exists: false}},
						{active_orders: {$lt: maxOrderAssigned }}
					]}
				];

				/** Get driver details */
				users.findOne(userConditions,{projection: {active_orders:1, orders:1}}).then(userData=>{

					/** Send error response */
					if(!userData) return resolve({
						status	:	Constants.STATUS_ERROR,
						message	: 	res.__("system.something_going_wrong_please_try_again"),
						captain_max_order_limit_or_unavailable: true
					});

					let activeOrders 	= 	userData.active_orders 	? userData.active_orders :0;
					let userOrderList 	=	userData.orders 		? userData.orders 		 :[];
					let alreadyAssigned = 	false;

					if(userOrderList.length >0){
						userOrderList.map(tmpRecords=>{
							if(String(tmpRecords.order_id) == String(orderId)) alreadyAssigned = true;
						});
					}

					/** Send error response */
					if(alreadyAssigned) return resolve({
						status			: Constants.STATUS_ERROR,
						message			: res.__("order_assignment.already_assigned_this_order"),
						already_assigned: true
					});

					asyncParallel({
						update_user : (callback)=>{
							/** Set driver update data */
							let updatedData = {
								// free_in  			: remainingDeliveryDuration,
								order_status  		: Constants.ORDER_DRIVER_ASSIGNED,
								delivery_latitude  	: restaurantLatitude,
								delivery_longitude 	: restaurantLongitude
							};

							/** Update driver details */
							users.updateOne({_id : captainId},{
								$set: updatedData,
								$inc: {
									active_orders				: 1,
									free_in						: remainingDeliveryDuration,
									order_prepare_remaining_time: remainingPreparationTime
								},
								$addToSet: {
									orders: {
										order_id		:	orderId,
										status			: 	Constants.ORDER_DRIVER_ASSIGNED,
										free_in			: 	remainingDeliveryDuration,
										preparation_time: 	remainingPreparationTime
									}
								}
							}).then(()=>{
								callback(null);
							}).catch(next);
						},
						insert_in_assignment_log : (callback)=>{
							/** Save order assignment logs */
							order_assignment_logs.insertOne({
								order_id 			: orderId,
								restaurant_id		: restaurantId,
								branch_id			: branchId,
								area_id				: areaId,
								delivery_area_id	: deliveryAreaId,
								captain_id 			: captainId,
								customer_id 		: customerId,
								assignment_type 	: assignmentType,
								cancelled_at 		: Helpers.getUtcDate(cancelledTime),
								status 				: Constants.ORDER_DRIVER_ASSIGNED,
								current_status		: Constants.ORDER_DRIVER_ASSIGNED,
								request_assigned_by : assignedBy,
								created 			: Helpers.getUtcDate()
							}).then(()=>{
								callback(null);
							}).catch(next);
						},
						update_in_order : (callback)=>{
							/** Update order details */
							orders.updateOne({_id : orderId},{
								$set: {
									assigned_captain		: 	captainId,
									assigned_captain_status	: 	Constants.ORDER_DRIVER_ASSIGNED,
									time_of_arrival			:	Helpers.getUtcDate(timeOfArrivalDate),
									assignment_type 		:	assignmentType
								}
							}).then(()=>{
								callback(null);
							}).catch(next);
						},
					},(userUpdateErr)=>{
						if(userUpdateErr) return next(userUpdateErr);

						/** Save order status logs */
						Helpers.saveOrderStatusLogs(req,res,next,{
							order_id 		: 	orderId,
							user_id			:	captainId,
							assigned_by 	: 	assignedBy,
							updated_by 		: 	captainId,
							user_role_id	:	Constants.DRIVER,
							user_type		:	Constants.DRIVER,
							status 			:	Constants.ORDER_DRIVER_ASSIGNED,
							order_status 	:	Constants.ORDER_DRIVER_ASSIGNED,
						}).then(()=>{

							/** Send success response */
							resolve({
								status			: Constants.STATUS_SUCCESS,
								captain_found	: true,
								message			: res.__("order_assignment.captain_assigned")
							});
						}).catch(next);
					});
				}).catch(next);
			});
		}).catch(next);
	};// end assignCaptainForOrder()

	/**
	 * This function accepts order id and assign captain for the order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As option Data
	 *
	 * @return json
	**/
	assignCaptainByOrderId (req,res,next,options){
		return new Promise(resolve=>{
			/** Send error response */
			if(!options.order_id) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			let saveAssignmentLogId =	new ObjectId();
			let orderId 			=	new ObjectId(options.order_id);
			const orders 			= 	this.db.collection(Tables.ORDERS);
			const order_details		=	this.db.collection(Tables.ORDER_DETAILS);
			const order_status_logs	=	this.db.collection(Tables.ORDER_STATUS_LOGS);

			console.log("\n\n\n\n\n\n Cron start - "+Helpers.newDate("",Constants.DATABASE_DATE_TIME_FORMAT)+" For order id -"+orderId+" assignment log id- "+saveAssignmentLogId+"\n");

			asyncParallel({
				order_data : (callback)=>{
					orders.findOne({_id : orderId}).then(orderDetailsData=>{
						callback(null,orderDetailsData);
					}).catch(next);
				},
				order_details : (callback)=>{
					order_details.findOne({order_id: orderId }).then(orderDetailsData=>{
						callback(null,orderDetailsData);
					}).catch(next);
				},
				preparing_status_details : (callback)=>{
					order_status_logs.findOne({
						order_id 	: 	orderId,
						status 		:	{$in: [Constants.ORDER_PREPARING,Constants.ORDER_READY_TO_PICK_UP]}
					}).then(orderDetailsData=>{
						callback(null,orderDetailsData);
					}).catch(next);
				},
				save_assignment_logs : (callback)=>{
					callback(null);

					this.saveAssignmentLogs(req,res,next,{
						order_id	: orderId,
						log_type	: "process_start",
						process_id	: saveAssignmentLogId
					}).then(()=>{ });
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.order_data || !asyncResponse.order_details) return resolve({
					status: Constants.STATUS_ERROR, order_not_found: true, message: res.__("system.something_going_wrong_please_try_again"),
				});

				let orderData  	  			= 	asyncResponse.order_data;
				let orderDetails  			= 	asyncResponse.order_details;
				let preparingStatusDetails 	= 	asyncResponse.preparing_status_details;
				let preparingStatusDate 	=	(preparingStatusDetails && preparingStatusDetails.created) ? preparingStatusDetails.created :Helpers.newDate();
				let orderProcessMaxTime 	=	Helpers.newDate(Helpers.subtractMinute(Constants.ORDER_PROCESS_TIME_IN_MINUTES));

				if(!orderData.order_assignment_process_time || Helpers.newDate(orderData.order_assignment_process_time) < orderProcessMaxTime){
					/* Add order assignment process time field */
					orders.updateOne({
						_id : orderId
					},{
						$set: {
							order_assignment_process_time: Helpers.getUtcDate()
						}
					},()=>{
						this.findCaptainForOrder(req,res,next,{
							order_details			: orderDetails,
							order_data				: orderData,
							save_assignment_log_id	: saveAssignmentLogId
						}).then(response=>{

							/* Unset order assignment process time field */
							orders.updateOne({
								_id : orderId
							},{
								$unset: {
									order_assignment_process_time: 1
								}
							},()=>{
								if(response.captain_max_order_limit_or_unavailable){
									/* find for other captain */
									this.assignCaptainByOrderId(req,res,next,{order_id: orderId }).then(assignmentResponse=>{
										return resolve(assignmentResponse);
									}).catch(next);
								}else{
									if(response.status == Constants.STATUS_ERROR || response.captain_found) return resolve(response);

									asyncParallel({
										update_order_details : (subCallback)=>{
											if(!response.exceed_max_distance || orderData.exceed_max_distance) return subCallback(null);

											/** Update order details when max distance exceed  */
											orders.updateOne({
												_id : orderId
											},
											{$set: {
												exceed_max_distance: Helpers.getUtcDate(),
											}},()=>{
												subCallback(null);
											}).catch(next);
										},
									},()=>{

										let orderPreparationTime 	=	(orderDetails.preparation_time) ? orderDetails.preparation_time :0;
										let hours	  				= 	orderPreparationTime/Constants.MINUTES_IN_A_HOUR;
										let checkDate 				=	Helpers.newDate(Helpers.addDaysToDate(hours,preparingStatusDate));

										/** Check preparation time is more than current time like preparation time 2.30 or current time is 2.00 */
										if(checkDate > Helpers.newDate()) return resolve(response);

										/** Update assign to fleet  */
										orders.updateOne({
											_id : orderId
										},
										{$set: {
											is_assign_to_fleet		: 	true,
											assign_to_fleet_time	:	Helpers.getUtcDate(checkDate),
										}},()=>{

											/* Assign order to fleet(Generate ticket): order should assign only once */
											Helpers.generateTicket(req,res,next,{
												type 		:  Constants.AUTOMATED_TICKET_FOR_DRIVER_NOT_AVAILABLE,
												order_id	:  orderId,
											}).then(ticketResponse=>{
												if(ticketResponse.status == Constants.STATUS_ERROR) return resolve(ticketResponse);

												resolve(response);
											}).catch(next);
										}).catch(next);
									});
								}
							}).catch(next);
						}).catch(next);
					}).catch(next);
				}else{
					resolve({ status: Constants.STATUS_ERROR, message: res.__("Assignment already in process") });
				}
			});
		}).catch(next);
	};// end assignCaptainByOrderId()

	/**
	 * Function to find captain
	 *
	 * @param req		As 	Request Data
	 * @param res		As 	Response Data
	 * @param next		As 	Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	findCaptainForOrder (req,res,next,options){
		return new Promise(resolve=>{
			let orderData 			= 	(options.order_data) 				? 	options.order_data 								:{};
			let orderDetails 		= 	(options.order_details) 			? 	options.order_details 							:{};
			let orderId				= 	(orderData._id) 					? 	new ObjectId(orderData._id) 					:"";
			let restaurantId		= 	(orderData.restaurant_id)			? 	new ObjectId(orderData.restaurant_id)			:"";
			let branchId			=	(orderData.branch_id) 				?	new ObjectId(orderData.branch_id) 				:"";
			let deliveryAreaId		=	(orderDetails.delivery_area_id)		? 	new ObjectId(orderDetails.delivery_area_id)		:"";
			let areaId				= 	(orderData.area_id) 				? 	new ObjectId(orderData.area_id) 				:"";
			let customerId			= 	(orderData.customer_id) 			?	new ObjectId(orderData.customer_id) 			:"";
			let restaurantLatitude	= 	(orderDetails.restaurant_latitude) 	? 	parseFloat(orderDetails.restaurant_latitude) 	:"";
			let restaurantLongitude	= 	(orderDetails.restaurant_longitude) ? 	parseFloat(orderDetails.restaurant_longitude)	:"";
			let customerLatitude	=	(orderDetails.customer_latitude) 	?	parseFloat(orderDetails.customer_latitude)		:"";
			let customerLongitude	= 	(orderDetails.customer_longitude) 	? 	parseFloat(orderDetails.customer_longitude) 	:"";
			let problemType			= 	(orderData.problem_type) 			? 	orderData.problem_type 							:"";
			let pickupLat			= 	(orderData.pickup_lat) 				? 	orderData.pickup_lat 							:0;
			let pickupLong			= 	(orderData.pickup_long)				?	orderData.pickup_long							:0;
			let customerDistance	= 	(orderData.customer_distance_from_branch)?	orderData.customer_distance_from_branch		:0;
			let assignedCaptain		= 	{};
			let captainFound		= 	false;
			let saveAssignmentLogId	= 	options.save_assignment_log_id;
			let captainFoundWhichPriority = "";
			const carMaxDistance	=	(res.locals.settings['Order_Assignment.car_max_distance']) ? parseInt(res.locals.settings['Order_Assignment.car_max_distance'])   :0;
			const bikeMaxDistance	= 	(res.locals.settings['Order_Assignment.bike_max_distance']) ? parseInt(res.locals.settings['Order_Assignment.bike_max_distance']) :0;

			/** Send success response */
			if(!restaurantLatitude || !restaurantLongitude){
				return resolve({status: Constants.STATUS_SUCCESS, captain_found: captainFound , message: res.__("Restaurant lat long problem"), });
			}

			/** Send success response */
			if(problemType && (!pickupLat || !pickupLong)){
				return resolve({ status:  Constants.STATUS_SUCCESS, captain_found: captainFound, message: res.__("Pickup lat long problem"), });
			}

			let orderPickupLatitude 	= 	(problemType)	? 	pickupLat	:restaurantLatitude;
			let orderPickupLongitude 	= 	(problemType) 	?	pickupLong 	:restaurantLongitude;
			let assignmentProcessId 	= 	new ObjectId();
			let distanceOptions 		=	{
				locations: [{
					latitude	: customerLatitude,
					longitude	: customerLongitude
				}],
				pickup_latitude : orderPickupLatitude,
				pickup_longitude: orderPickupLongitude,
			};

			const order_assignment_logs =	this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
			asyncParallel({
				previously_assigned_captains : (callback)=>{
					/* get previously assigned captain ids of this order */
					order_assignment_logs.distinct("captain_id",{order_id:orderId}).then(captainIds=>{
						callback(null,captainIds);
					}).catch(next);
				},
				customer_distance : (callback)=>{
					if(!customerLatitude || !customerLatitude) return callback(null,{invalid: false, distance:0});

					if(customerDistance) return callback(null,{invalid: false, distance: customerDistance});

					/* get distance between two location */
					let tmpDisOpt = clone(distanceOptions);
					this.getDistanceBetweenLocations(req,res,next,tmpDisOpt).then(locationResponse=>{
						if(locationResponse.status == Constants.STATUS_ERROR) return callback(null,{invalid:true, response:locationResponse});

						let disLocations = (locationResponse.locations)	?	locationResponse.locations[0] 	:{};
						let tmpDistance	 = (disLocations.distance_in_km)?	disLocations.distance_in_km		:0;
						let invalid	 	 = (disLocations.invalid)		?	disLocations.invalid			:0;

						if(invalid) return callback(null,{invalid:true, distance:0, response:locationResponse});

						/** Save customer distance logs */
						const orders = this.db.collection(Tables.ORDERS);
						orders.updateOne({
							_id: orderId
						},
						{$set: {
							customer_distance_from_branch: parseFloat(tmpDistance)
						}}).then(()=>{

							callback(null,{invalid: false, distance: tmpDistance, response:locationResponse});
						}).catch(next);
					}).catch(next);
				},
				branch_details : (callback)=>{
					/** Get branch details */
					const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.findOne({_id : branchId },{projection: {delivery_vehicle_type:1}}).then(beResult=>{
						callback(null,beResult);
					}).catch(next);
				},
				restaurant_details : (callback)=>{
					/** Get restaurant details */
					const restaurants = this.db.collection(Tables.RESTAURANTS);
					restaurants.findOne({_id : restaurantId },{projection: {delivery_vehicle_type:1}}).then(beResult=>{
						callback(null,beResult);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let customerDistance 	=	asyncResponse.customer_distance;
				let branchDetails	 	=	(asyncResponse.branch_details) 			?	asyncResponse.branch_details 		:{};
				let restDetails	 		=	(asyncResponse.restaurant_details) 		? 	asyncResponse.restaurant_details 	:{};
				let restVehicleTypes 	=	(restDetails.delivery_vehicle_type) 	? 	restDetails.delivery_vehicle_type	:[];
				let branchVehicleTypes 	=	(branchDetails.delivery_vehicle_type) 	? 	branchDetails.delivery_vehicle_type	:[];
				let finalVehicleTypes	=	(branchVehicleTypes.length >0)			?	branchVehicleTypes					:restVehicleTypes;
				let onlyHaveOneVehicle 	= 	(finalVehicleTypes.length == 1) ? true :false;

				/** Save assignment process logs */
				this.saveAssignmentLogs(req,res,next,{
					order_id	: orderId,
					log_type	: "customer_distance",
					process_id	: saveAssignmentLogId,
					customer_distance: {
						carMaxDistance 	: carMaxDistance,
						bikeMaxDistance : bikeMaxDistance,
						distanceOptions : distanceOptions,
						distance 		: (customerDistance.distance) ? customerDistance.distance :0,
						response 		: (customerDistance.response) ? customerDistance.response :{},
						final_vehicle_type		:	finalVehicleTypes,
						branch_vehicle_type		: 	branchVehicleTypes,
						restaurant_vehicle_type	:	restVehicleTypes,
					}
				}).then(()=>{ });

				/** Send error response */
				if(customerDistance.invalid){
					return resolve({status: Constants.STATUS_SUCCESS, captain_found: captainFound, customerDistance: customerDistance, message: res.__("Customer lat long problem") });
				}

				/** Send error response */
				let customerDistanceInKm = asyncResponse.customer_distance.distance;
				if(!onlyHaveOneVehicle && customerDistanceInKm && carMaxDistance < customerDistanceInKm && bikeMaxDistance < customerDistanceInKm){
					return resolve({status: Constants.STATUS_SUCCESS, exceed_max_distance: true, message: res.__("Assignment max distance reached") });
				}

				let optimalOptions 							= 	clone(options);
				optimalOptions.customer_distance			= 	customerDistanceInKm;
				optimalOptions.distance_in_km				= 	customerDistanceInKm;
				optimalOptions.previously_assigned_captains	=	asyncResponse.previously_assigned_captains;
				optimalOptions.assignment_process_id 		= 	assignmentProcessId;

				/** Save assignment process logs */
				this.saveAssignmentProcessLogs(req,res,next,{
					order_id 					: 	orderId,
					driver_ids 					: 	[],
					process_id				 	:	assignmentProcessId,
					assignment_process_details 	:	{},
				}).then(()=>{});

				let processDriverIds 	 		= 	[];
				let allCaptainIds 	 			= 	[];
				let assignmentProcessDetails 	=	{};
				asyncSeries({
					find_already_assigned_captains_same_customer: (callback)=>{
						if(problemType)  return callback(null,null);

						/* first priority with same customer : find assigned captains, who is already assigned to the same restaurant */
						optimalOptions.priority_type = "find_already_assigned_captains";
						optimalOptions.same_customer = true;

						this.findOptimalCaptains(req,res,next,optimalOptions).then((assignmentResponse)=>{
							assignmentProcessDetails["find_already_assigned_captains_same_customer"] = (assignmentResponse.captain_found) ? assignmentResponse.assigned_captain._id :"";

							if(assignmentResponse.all_captain_ids && assignmentResponse.all_captain_ids.length > 0){
								allCaptainIds	=	allCaptainIds.concat(assignmentResponse.all_captain_ids);
							}

							if(assignmentResponse.captain_found) {
								assignedCaptain 	= 	assignmentResponse.assigned_captain;
								captainFound		= 	true;
								processDriverIds.push(assignedCaptain._id);
								captainFoundWhichPriority = "find_already_assigned_captains_same_customer";
							}
							callback(null,assignmentResponse);
						}).catch(next);
					},
					find_already_assigned_captains: (callback)=>{
						if(problemType)  return callback(null,null);

						/* first priority with different customer : find assigned captains, who is already assigned to the same restaurant */
						if(captainFound) return callback(null,null);

						if(optimalOptions.same_customer) delete optimalOptions.same_customer;

						optimalOptions.priority_type = "find_already_assigned_captains";
						this.findOptimalCaptains(req,res,next,optimalOptions).then((assignmentResponse)=>{
							assignmentProcessDetails["find_already_assigned_captains"] = (assignmentResponse.captain_found) ? assignmentResponse.assigned_captain._id :"";

							if(assignmentResponse.all_captain_ids && assignmentResponse.all_captain_ids.length > 0){
								allCaptainIds	=	allCaptainIds.concat(assignmentResponse.all_captain_ids);
							}

							if(assignmentResponse.captain_found) {
								assignedCaptain = assignmentResponse.assigned_captain;
								captainFound	= true;
								processDriverIds.push(assignedCaptain._id);
								captainFoundWhichPriority = "find_already_assigned_captains";
							}
							callback(null,assignmentResponse);
						}).catch(next);
					},
					find_max_buffer_captains: (callback)=>{
						/* Second priority : find captain by adding max buffer in preparation time, captain who is available more than actual preparation time  will be assigned first in this case
							like
								preparation time		= 	20,
								max buffer time 		= 	10,
								total preparation time	=	30 (preparation time + max buffer time)
								or captains are available 18, 20, 21, 28, 29 minutes
								than order is assign to 21 minutes
						*/
						if(captainFound) return callback(null,null);

						optimalOptions.priority_type = "find_max_buffer_captains";
						this.findOptimalCaptains(req,res,next,optimalOptions).then((assignmentResponse)=>{
							assignmentProcessDetails["find_max_buffer_captains"] = (assignmentResponse.captain_found) ? assignmentResponse.assigned_captain._id :"";

							if(assignmentResponse.all_captain_ids && assignmentResponse.all_captain_ids.length > 0){
								allCaptainIds	=	allCaptainIds.concat(assignmentResponse.all_captain_ids);
							}

							if(assignmentResponse.captain_found) {
								assignedCaptain = assignmentResponse.assigned_captain;
								captainFound	= true;
								processDriverIds.push(assignedCaptain._id);
								captainFoundWhichPriority = "find_max_buffer_captains";
							}
							callback(null,assignmentResponse);
						}).catch(next);
					},
				},(seriesErr,seriesResponse)=>{
					if(seriesErr) return next(seriesErr);

					/** Save assignment logs */
					this.saveAssignmentLogs(req,res,next,{
						order_id			: orderId,
						log_type			: "all_driver",
						process_id			: saveAssignmentLogId,
						order_details		: orderData,
						order_sub_details	: orderDetails,
						all_captain_ids		: allCaptainIds,
						restaurant_latitude	: restaurantLatitude,
						restaurant_longitude: restaurantLongitude,
						pickup_details		: {
							latitude 		:	orderPickupLatitude,
							longitude 		: 	orderPickupLongitude,
						},
					}).then(()=>{ });

					/** Send response */
					if(seriesResponse.find_already_assigned_captains_same_customer && seriesResponse.find_already_assigned_captains_same_customer.status == Constants.STATUS_ERROR) return resolve(seriesResponse.find_already_assigned_captains_same_customer);
					if(seriesResponse.find_already_assigned_captains && seriesResponse.find_already_assigned_captains.status == Constants.STATUS_ERROR) return resolve(seriesResponse.find_already_assigned_captains);
					if(seriesResponse.find_optimal_captain && seriesResponse.find_optimal_captain.status == Constants.STATUS_ERROR) return resolve(seriesResponse.find_optimal_captain);
					if(seriesResponse.find_max_buffer_captains && seriesResponse.find_max_buffer_captains.status == Constants.STATUS_ERROR) return resolve(seriesResponse.find_max_buffer_captains);

					/** Save assignment process logs */
					this.saveAssignmentProcessLogs(req,res,next,{
						order_id 					: 	orderId,
						driver_ids 					: 	processDriverIds,
						process_id				 	:	optimalOptions.assignment_process_id,
						assignment_process_details 	:	assignmentProcessDetails,
					}).then(()=>{});

					if(!captainFound){
						/** Save assignment logs */
						this.saveAssignmentLogs(req,res,next,{
							order_id			: orderId,
							log_type			: "assigned_driver",
							process_id			: saveAssignmentLogId,
							order_details		: orderData,
							order_sub_details	: orderDetails,
							assigned_driver 	: {},
							captain_found_which_priority : captainFoundWhichPriority,
						}).then(()=>{ });

						/** Send response */
						return resolve({status:	Constants.STATUS_SUCCESS, captain_found: captainFound, message: res.__("No captain available at the moment"),});
					}

					/** Assign order to captain  */
					this.assignCaptainForOrder(req,res,next,{
						order_id 				: orderId,
						restaurant_id 			: restaurantId,
						branch_id 				: branchId,
						delivery_area_id 		: deliveryAreaId,
						area_id 				: areaId,
						captain_id 				: assignedCaptain._id,
						time_of_arrival 		: assignedCaptain.time_of_arrival,
						customer_id 			: customerId,
						restaurant_latitude 	: restaurantLatitude,
						restaurant_longitude 	: restaurantLongitude
					}).then((assignCaptainResponse)=>{

						/** Send response */
						resolve(assignCaptainResponse);

						/** Save assignment logs */
						this.saveAssignmentLogs(req,res,next,{
							order_id			: orderId,
							log_type			: "assigned_driver",
							process_id			: saveAssignmentLogId,
							order_details		: orderData,
							order_sub_details	: orderDetails,
							assigned_driver 	: assignedCaptain,
							captain_found_which_priority : captainFoundWhichPriority,
						}).then(()=>{ });
					});
				});
			});
        }).catch(next);
	};// end findCaptainForOrder()

	/**
	 * Function to get distance between locations
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	findOptimalCaptains (req,res,next,options){
		return new Promise(resolve=>{
			const maximumBufferTime		= (res.locals.settings['Order_Assignment.maximum_buffer_time']) ? parseInt(res.locals.settings['Order_Assignment.maximum_buffer_time']) :0;
			const assignmentBufferTime	= (res.locals.settings['Order_Assignment.assignment_buffer_time'])? parseInt(res.locals.settings['Order_Assignment.assignment_buffer_time']) :0;
			const maxOrderAssigned		= (res.locals.settings['Order_Assignment.max_order_assigned_to_captain']) ? parseInt(res.locals.settings['Order_Assignment.max_order_assigned_to_captain']) :0;
			const carMaxDistance		= (res.locals.settings['Order_Assignment.car_max_distance']) ? parseInt(res.locals.settings['Order_Assignment.car_max_distance']) :0;
			const bikeMaxDistance		= (res.locals.settings['Order_Assignment.bike_max_distance']) ? parseInt(res.locals.settings['Order_Assignment.bike_max_distance']) :0;

			let previouslyAssignedCaptains= (options.previously_assigned_captains) ? options.previously_assigned_captains 		:[];
			let orderData 			=	(options.order_data) 				?	options.order_data 								:{};
			let orderDetails 		= 	(options.order_details) 			? 	options.order_details 							:{};
			let orderId				= 	(orderData._id) 					? 	new ObjectId(orderData._id) 					:"";
			let restaurantId		= 	(orderData.restaurant_id) 			? 	new ObjectId(orderData.restaurant_id) 			:"";
			let branchId			= 	(orderData.branch_id) 				? 	new ObjectId(orderData.branch_id) 				:"";
			let deliveryAreaId		= 	(orderDetails.delivery_area_id) 	? 	new ObjectId(orderDetails.delivery_area_id) 	:"";
			let restaurantLatitude	= 	(orderDetails.restaurant_latitude) 	?	parseFloat(orderDetails.restaurant_latitude)	:"";
			let restaurantLongitude	= 	(orderDetails.restaurant_longitude) ?	parseFloat(orderDetails.restaurant_longitude) 	:"";
			let customerId			= 	(orderData.customer_id) 			? 	new ObjectId(orderData.customer_id) 			:"";
			let problemType			=	(orderData.problem_type)			? 	orderData.problem_type 							:"";
			let pickupLat			= 	(orderData.pickup_lat) 				? 	orderData.pickup_lat 							:0;
			let pickupLong			= 	(orderData.pickup_long)				?	orderData.pickup_long							:0;
			let isBigOrder  		=   (orderData.is_big_order)    		?   orderData.is_big_order  						:false;
			let customerDistance  	=   (orderData.customer_distance)    	?   orderData.customer_distance						:0;
			let saveAssignmentLogId	= 	options.save_assignment_log_id;

			const users	=	this.db.collection(Tables.USERS);
			asyncParallel({
				other_restaurants : (callback)=>{
					if(options.priority_type != "find_other_restaurant_captains") return callback(null,null);

					/* Currently i am getting all the branches ids, but this will change to near by restaurants */
					let restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.find({},{projection: {restaurant_id:1}}).toArray().then().then(result=>{
						let branchIds = [];
						result.map(records=>{
							branchIds.push(records._id);
						});
						callback(null,branchIds);
					}).catch(next);
				}
			},(otherRestaurantsErr,otherRestaurants)=>{
				if(otherRestaurantsErr) return next(otherRestaurantsErr);

				asyncParallel({
					already_assigned_captains : (callback)=>{
						if(options.priority_type != "find_already_assigned_captains" && options.priority_type != "find_other_restaurant_captains") return callback(null,null);
						const order_assignment_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);

						let assignmentConditions = {
							delivery_area_id: deliveryAreaId,
						};

						if(options.priority_type == "find_already_assigned_captains"){
							assignmentConditions["current_status"] = { $in : [
								Constants.ORDER_DRIVER_ASSIGNED,
								Constants.ORDER_DRIVER_ACCEPTED,
								Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT
							] };
							assignmentConditions["restaurant_id"] 	= restaurantId;
							assignmentConditions["branch_id"] 		= branchId;
						}else if(options.priority_type == "find_other_restaurant_captains"){
							assignmentConditions["current_status"] = { $in : [
								Constants.ORDER_DRIVER_ASSIGNED,
								Constants.ORDER_DRIVER_ACCEPTED
							] };
							assignmentConditions["branch_id"] = {$in: otherRestaurants.other_restaurants };
						}
						if(options.same_customer) assignmentConditions["customer_id"] = customerId;

						order_assignment_logs.distinct("captain_id",assignmentConditions).then(captainIds=>{
							callback(null,captainIds);
						}).catch(next);
					},
					available_captains : (callback)=>{
						if(options.priority_type != "find_optimal_captain" && options.priority_type != "find_max_buffer_captains") return callback(null,null);

						let currentDate 	= Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
						let todayStartDate 	= Helpers.newDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
						let todayEndDate   	= Helpers.newDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

						/** Get captain ids */
						const driver_availabilities	= this.db.collection(Tables.DRIVER_AVAILABILITIES);
						driver_availabilities.distinct("user_id",{
							date	: { $gte: todayStartDate, $lte: todayEndDate},
							area_id : deliveryAreaId
						}).then(driverIds=>{
							callback(null,driverIds);
						}).catch(next);
					},
					remaining_preparation_data : (callback)=>{
						const order_details = this.db.collection(Tables.ORDER_DETAILS);

						/* Get remaining preparation time of order, All data is already received in options.order_details but we need exact remaining time of order, that's why we are finding order detail here */
						order_details.findOne({
							order_id : orderId
						},{projection: {remaining_preparation_time:1}}).then(orderPreparationData=>{
							callback(null,orderPreparationData);
						}).catch(next);
					},
					assignment_slabs : (callback)=>{
						/** Get assignment slabs */
						const assignment_slabs = this.db.collection(Tables.ASSIGNMENT_SLABS);
						assignment_slabs.find({},{projection: {order:1,min_distance:1,max_distance:1}}).sort({order: Constants.SORT_ASC}).toArray().then(slabResult=>{
							callback(null,slabResult);
						}).catch(next);
					},
					branch_details : (callback)=>{
						/** Get branch details */
						const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
						restaurant_branches.findOne({_id : branchId },{projection: {delivery_vehicle_type:1}}).then(beResult=>{
							callback(null,beResult);
						}).catch(next);
					},
					restaurant_details : (callback)=>{
						/** Get restaurant details */
						const restaurants = this.db.collection(Tables.RESTAURANTS);
						restaurants.findOne({_id : restaurantId },{projection: {delivery_vehicle_type:1}}).then(beResult=>{
							callback(null,beResult);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let slabData = (asyncResponse.assignment_slabs) ? asyncResponse.assignment_slabs :[];

					/** Send error response */
					if(!asyncResponse.remaining_preparation_data || !asyncResponse.branch_details || !asyncResponse.restaurant_details){
						return resolve({
							status: Constants.STATUS_ERROR, order_not_found: true, message: res.__("system.something_going_wrong_please_try_again"), asyncResponse: asyncResponse
						});
					}

					let branchDetails		=	asyncResponse.branch_details;
					let restDetails			=	asyncResponse.restaurant_details;
					let restVehicleTypes 	=	(restDetails.delivery_vehicle_type) 	? 	restDetails.delivery_vehicle_type	:[];
					let branchVehicleTypes 	=	(branchDetails.delivery_vehicle_type) 	? 	branchDetails.delivery_vehicle_type :[];
					branchVehicleTypes		=	(branchVehicleTypes.length >0)			?	branchVehicleTypes					:restVehicleTypes;
					let onlyHaveBike 		= 	false;
					let onlyHaveCar	 		=	false;

					if(branchVehicleTypes.length == 1){
						if(branchVehicleTypes.indexOf(Constants.VEHICLE_TYPE_BIKE) >= 0) onlyHaveBike = true;
						if(branchVehicleTypes.indexOf(Constants.VEHICLE_TYPE_CAR) >= 0) onlyHaveCar = true;
					}

					let remainingPreparitionTime 	=	parseInt(asyncResponse.remaining_preparation_data.remaining_preparation_time);
					let custDisIsCar				=	(customerDistance && customerDistance > bikeMaxDistance) ? true :false;
					let vehicleTypeArray			=	branchVehicleTypes;

					if(!onlyHaveBike && (isBigOrder || custDisIsCar)){
						vehicleTypeArray = [Constants.VEHICLE_TYPE_CAR];
					}

					let isCaptainFound			=	false;
					let allCaptainIds			=	[];
					let assignedCaptainDetails	=	{};
					eachOfSeries(slabData,(data,key,parentCallback)=>{
						let slabMaxDis 	=	data.max_distance;
						let slabMinDis	= 	data.min_distance;

						if(isCaptainFound) return parentCallback(null);

						eachOfSeries(vehicleTypeArray,(tmpVehicleType,childKey,seriesCallback)=>{
							if(isCaptainFound) return seriesCallback(null);

							/** Return if slab distance more than max distance of car and bike  */
							if(!onlyHaveBike && tmpVehicleType == Constants.VEHICLE_TYPE_BIKE && slabMaxDis > bikeMaxDistance) return seriesCallback(null);
							if(!onlyHaveCar && tmpVehicleType == Constants.VEHICLE_TYPE_CAR && slabMaxDis > carMaxDistance) return seriesCallback(null);

							/* Manage this conditions from global constant */
							let logConditions 		=	{};
							let userConditions 		=	clone(Constants.DRIVER_ASSIGNMENT_CONDITIONS);
							userConditions["$and"] 	=	[
								{_id : {$nin : previouslyAssignedCaptains}},
								{vehicle_type: tmpVehicleType},
								{$or : [
									{active_orders : {$exists: false}},
									{active_orders : {$lt: maxOrderAssigned }}
								]}
							];

							logConditions.branch_vehicle_type 	=	branchVehicleTypes;
							logConditions.priority_type 		=	options.priority_type;
							logConditions.previous_driver 		=	previouslyAssignedCaptains;
							logConditions.vehicle_type 			= 	tmpVehicleType;
							logConditions.active_orders 		= 	maxOrderAssigned;

							if(options.priority_type == "find_optimal_captain" || options.priority_type == "find_max_buffer_captains"){
								logConditions.order_status  = [
									Constants.ORDER_DRIVER_FREE, Constants.ORDER_DRIVER_WAY_TO_CUSTOMER, Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION
								];

								userConditions["$and"].push({
									"$or" : [
										{order_status : {$exists: false}},
										{$or: [
											{order_status: {$in: [
												Constants.ORDER_DRIVER_FREE,
												Constants.ORDER_DRIVER_WAY_TO_CUSTOMER,
												Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION
											]}},
											{"orders.status": {$in: [
												Constants.ORDER_DRIVER_WAY_TO_CUSTOMER,
												Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION
											]}}
										]}
									]
								});
							}else if(options.priority_type == "find_already_assigned_captains"){

								logConditions.already_assigned_captains  = asyncResponse.already_assigned_captains;
								logConditions.order_status  = [Constants.ORDER_DRIVER_ASSIGNED, Constants.ORDER_DRIVER_ACCEPTED, Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT];

								userConditions["$and"].push({_id: {$in: asyncResponse.already_assigned_captains}});
								userConditions["$and"].push({
									"orders.status": {$in: [
										Constants.ORDER_DRIVER_ASSIGNED,
										Constants.ORDER_DRIVER_ACCEPTED,
										Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT
									]}
								});
							}else if(options.priority_type == "find_other_restaurant_captains"){
								logConditions.already_assigned_captains  = asyncResponse.already_assigned_captains;
								logConditions.order_status  = [Constants.ORDER_DRIVER_ASSIGNED, Constants.ORDER_DRIVER_ACCEPTED];

								userConditions["$and"].push({_id : {$in : asyncResponse.already_assigned_captains}});
								userConditions["$and"].push({
									"orders.status": {$in: [
										Constants.ORDER_DRIVER_ASSIGNED,
										Constants.ORDER_DRIVER_ACCEPTED,
									]}
								});
							}

							logConditions.restaurant_coordinates= 	[restaurantLongitude , restaurantLatitude ];
							logConditions.slab_min_distance  	= 	parseFloat(slabMinDis)*Constants.ONE_KMS_TO_METER;
							logConditions.slab_max_distance  	=	parseFloat(slabMaxDis)*Constants.ONE_KMS_TO_METER;

							/** Get eligible drivers list */
							users.aggregate([
								{$geoNear: {
									near : {
										type			: 	"Point",
										coordinates		: 	[ restaurantLongitude , restaurantLatitude ]
									},
									distanceMultiplier	: 	1 / Constants.ONE_KMS_TO_METER,	//  return distance in miles
									distanceField		: 	"query_distance",				//  return  total distance
									spherical			: 	false,	//	Required if using a 2dsphere index. use to check coordinate in circle
									maxDistance			: 	parseFloat(slabMaxDis)*Constants.ONE_KMS_TO_METER,
									minDistance			: 	parseFloat(slabMinDis)*Constants.ONE_KMS_TO_METER,
									query				: 	userConditions,
									includeLocs			:	'locs',		//  return branch matched coordinate
								}},
								{$match : userConditions},
								{$project: {full_name: 1, vehicle_type: 1, order_status: 1, order_prepare_remaining_time: 1, free_in: 1, latitude: 1, longitude: 1, delivery_latitude: 1, delivery_longitude: 1, driver_id: 1, locs: 1, query_distance: 1, orders: 1  }}
							]).toArray().then(captainList=>{

								/** Set assignment process logs */
								let processOptions = {
									order_id 		: 	orderId,
									driver_ids 		: 	[],
									process_id		:	options.assignment_process_id,
									assignment_type :	options.priority_type,
								};

								if(captainList.length == 0){
									/** Save assignment process logs */
									this.saveAssignmentProcessStepLogs(req,res,next,processOptions).then(()=>{});

									/** Save assignment logs */
									this.saveAssignmentLogs(req,res,next,{
										order_id					: 	orderId,
										log_type					: 	"eligible_drivers_with_google",
										slab_min_distance			: 	slabMinDis,
										slab_max_distance			: 	slabMaxDis,
										vehicle_type				:	tmpVehicleType,
										process_id					: 	saveAssignmentLogId,
										order_details				: 	orderData,
										order_sub_details			: 	orderDetails,
										priority_type 				: 	options.priority_type,
										same_customer 				: 	options.same_customer,
										maximum_buffer_time			:	maximumBufferTime,
										assignment_buffer_time		:	assignmentBufferTime,
										eligible_drivers_with_google:	captainList,
										remaining_preparation_time	: 	remainingPreparitionTime,
										max_order_assigned_to_captain: 	maxOrderAssigned,
										log_conditions				: 	logConditions,
									}).then(()=>{ });

									/** Send response */
									return seriesCallback(null);
								}

								let processDriverIds = [];
								captainList.map(captainData=>{
									allCaptainIds.push(captainData._id);
									processDriverIds.push(captainData._id);

									if(!captainData.free_in || options.priority_type == "find_already_assigned_captains") captainData.free_in = 0;

									if((options.priority_type == "find_optimal_captain" || options.priority_type == "find_max_buffer_captains") && [ Constants.ORDER_DRIVER_WAY_TO_CUSTOMER,Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION ].indexOf(captainData.order_status) !== -1 ) {
										captainData.latitude	= 	captainData.delivery_latitude;
										captainData.longitude	= 	captainData.delivery_longitude;
									}else{
										captainData.free_in		=	0;
									}
								});

								/** Save assignment process logs */
								processOptions.driver_ids = processDriverIds;
								this.saveAssignmentProcessStepLogs(req,res,next,processOptions).then(()=>{});

								/** Filter eligible drivers list according to assignment conditions  */
								this.filterLocations(req,res,next,{
									captains			:	captainList,
									pickup_latitude 	: 	(problemType) ? pickupLat :restaurantLatitude,
									pickup_longitude	: 	(problemType) ? pickupLong :restaurantLongitude,
									remaining_time		: 	remainingPreparitionTime,
									priority_type		: 	options.priority_type,
									same_customer		:	options.same_customer,
									order_id 			: 	orderId,
									customer_distance 	: 	customerDistance,
									save_assignment_log_id: saveAssignmentLogId,
									slab_min_distance	: 	slabMinDis,
									slab_max_distance	: 	slabMaxDis,
									vehicle_type		:	tmpVehicleType,
									log_conditions		: 	logConditions,
									only_have_bike		: 	onlyHaveBike,
									only_have_car		: 	onlyHaveCar,
								}).then(assignmentResponse=>{
									if(assignmentResponse.status == Constants.STATUS_ERROR) return seriesCallback(assignmentResponse);

									if(assignmentResponse.assigned_captain){
										isCaptainFound 		  	= 	true;
										assignedCaptainDetails 	=	assignmentResponse.assigned_captain;
									}
									seriesCallback(null);
								}).catch(next);
							}).catch(next);
						},childEachErr=>{
							parentCallback(childEachErr);
						});
					},eachErr=>{
						if(eachErr) return resolve(eachErr);

						resolve({
							status			 : 	Constants.STATUS_SUCCESS,
							captain_found	 :	isCaptainFound,
							assigned_captain :	assignedCaptainDetails,
							all_captain_ids	 :	allCaptainIds
						});
					});
				});
			});
		}).catch(next);
	};// end findOptimalCaptains()

	/**
	 * Function to filter 1 location according to conditions
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middle ware function
	 * @param options As data object
	 *
	 * @return json
	**/
	filterLocations (req,res,next,options){
		return new Promise(resolve=>{
			const maximumBufferTime	= (res.locals.settings['Order_Assignment.maximum_buffer_time']) ? parseInt(res.locals.settings['Order_Assignment.maximum_buffer_time']) :0;
			const assignmentBufferTime= (res.locals.settings['Order_Assignment.assignment_buffer_time'])? parseInt(res.locals.settings['Order_Assignment.assignment_buffer_time']) :0;
			const carMaxDistance	=	(res.locals.settings['Order_Assignment.car_max_distance'])	? 	parseInt(res.locals.settings['Order_Assignment.car_max_distance']) 	:0;
			const bikeMaxDistance	= 	(res.locals.settings['Order_Assignment.bike_max_distance']) ?	parseInt(res.locals.settings['Order_Assignment.bike_max_distance']) :0;
			const maxOrderAssigned	= 	(res.locals.settings['Order_Assignment.max_order_assigned_to_captain']) ? parseInt(res.locals.settings['Order_Assignment.max_order_assigned_to_captain']) :0;

			let orderId				= 	options.order_id;
			let saveAssignmentLogId	=	options.save_assignment_log_id;

			let distanceOptions 		= clone(options);
			distanceOptions.locations  	= options.captains;
			delete distanceOptions.captains;

			asyncParallel({
				captain_list : (callback)=>{
					if(options.priority_type == "find_already_assigned_captains"){
						return callback(null, distanceOptions.locations)
					}

					/** Send to google api to get distance */
					this.getDistanceBetweenLocations(req,res,next,distanceOptions).then(locationResponse=>{
						if(locationResponse.status == Constants.STATUS_ERROR) return callback(locationResponse);

						callback(null, locationResponse.locations);
					}).catch(next);
				}
			},(asyncErr,asyncResponse)=>{
				if(asyncErr){
					/** Save assignment logs */
					this.saveAssignmentLogs(req,res,next,{
						order_id			: 	orderId,
						log_type			: 	"eligible_drivers_with_google",
						process_id			: 	saveAssignmentLogId,
						priority_type 		: 	options.priority_type,
						google_error		:	asyncErr,
						eligible_drivers_with_google: [],
						remaining_preparation_time: distanceOptions.remaining_time,
						assignment_buffer_time: assignmentBufferTime,
						maximum_buffer_time	:	maximumBufferTime,
						same_customer		:	distanceOptions.same_customer,
						google_options		:	distanceOptions,
						slab_min_distance	: 	distanceOptions.slab_min_distance,
						slab_max_distance	: 	distanceOptions.slab_max_distance,
						vehicle_type		:	distanceOptions.vehicle_type,
						log_conditions		:	distanceOptions.log_conditions,
						max_order_assigned_to_captain: 	maxOrderAssigned,
					}).then(()=>{ });

					return resolve(asyncErr);
				}

				let captainList 	=	asyncResponse.captain_list;
				let remainingTime 	=	distanceOptions.remaining_time;
				let onlyHaveBike 	= 	distanceOptions.only_have_bike;
				let onlyHaveCar		= 	distanceOptions.only_have_car;

				/** Save assignment logs */
				this.saveAssignmentLogs(req,res,next,{
					order_id					:	orderId,
					log_type					:	"eligible_drivers_with_google",
					process_id					:	saveAssignmentLogId,
					priority_type 				:	options.priority_type,
					same_customer				:	distanceOptions.same_customer,
					maximum_buffer_time			:	maximumBufferTime,
					assignment_buffer_time		:	assignmentBufferTime,
					remaining_preparation_time	:	remainingTime,
					eligible_drivers_with_google: 	captainList,
					slab_min_distance			: 	distanceOptions.slab_min_distance,
					slab_max_distance			: 	distanceOptions.slab_max_distance,
					vehicle_type				:	distanceOptions.vehicle_type,
					log_conditions				:	distanceOptions.log_conditions,
					max_order_assigned_to_captain: 	maxOrderAssigned,
				}).then(()=>{ });

				let finalLocations 	= [];
				let sortType		= Constants.SORT_DESC;
				let sortKeys 		= [];
				if(distanceOptions.priority_type == "find_max_buffer_captains"){
					sortType = Constants.SORT_ASC;
				}

				captainList.map(locationData=>{
					if(locationData.invalid) return;

					let remainingBufferTime 	= 	remainingTime;
					let locationDistance		= 	locationData.distance_in_minutes+locationData.free_in;
					let locationDistanceInKm	=	locationData.distance_in_km;
					let tmpVehicleType			=	locationData.vehicle_type;

					if(options.priority_type == "find_already_assigned_captains" ){
						/* Both first and second order should not be delay, including buffer time */
						if(locationData.order_prepare_remaining_time <= remainingBufferTime && locationData.order_prepare_remaining_time+assignmentBufferTime  >= remainingBufferTime){
							finalLocations.push(locationData);
						}else if(locationData.order_prepare_remaining_time >= remainingBufferTime && locationData.order_prepare_remaining_time <= remainingBufferTime+assignmentBufferTime){
							finalLocations.push(locationData);
						}
						return;
					}else{
						remainingBufferTime = remainingTime+maximumBufferTime;

						if(locationDistance <= remainingBufferTime){
							if(tmpVehicleType == Constants.VEHICLE_TYPE_BIKE && (onlyHaveBike || locationDistanceInKm <= bikeMaxDistance)){
								finalLocations.push(locationData);
							}else if(tmpVehicleType == Constants.VEHICLE_TYPE_CAR && (onlyHaveCar || locationDistanceInKm <= carMaxDistance)){
								finalLocations.push(locationData);
							}
						}
					}
				});

				if(finalLocations.length==0) return resolve({ status: Constants.STATUS_SUCCESS });

				let distanceField = "distance_in_minutes";
				if(sortType == Constants.SORT_DESC) distanceField = "-"+distanceField;
				sortKeys.push(distanceField);

				let vehicleField = "vehicle_type";
				sortKeys.push(vehicleField);

				let sortedLocations = finalLocations.sort(this.sortByKey(sortKeys));

				resolve({ assigned_captain: sortedLocations[0] });
			});
        }).catch(next);
	};// end filterLocations()

	/**
	 * Function to sort array
	 *
	 * @param fields As fields array
	 *
	 * @return array
	**/
	sortByKey = (fields) => (a, b) => fields.map(o => {
		let dir = 1;
		if (o[0] === '-') { dir = -1; o=o.substring(1); }
		return a[o] > b[o] ? dir : a[o] < b[o] ? -(dir) : 0;
	}).reduce((p, n) => p ? p : n, 0);
	// End sortByKey()

	/**
	 * Function to get distance between locations
	 *
	 * @param req		As 	Request Data
	 * @param res		As 	Response Data
	 * @param next		As 	Callback argument to the middleware function
	 * @param options	As	Object data for get distance
	 *
	 * @return json
	**/
	getDistanceBetweenLocations (req,res,next,options){
		return new Promise(resolve=>{
			/** Send error response */
			if(!options.pickup_latitude || !options.pickup_longitude || !options.locations) return resolve({
				status: Constants.STATUS_ERROR,
				message: res.__("system.invalid_access")
			});

			let latitudeField 	=	options.latitude_field	? 	options.latitude_field	:"latitude";
			let longitudeField	= 	options.longitude_field ?	options.longitude_field :"longitude";

			/** Send success response */
			if(options.locations.length == 0) return resolve({
				status: Constants.STATUS_SUCCESS,
				locations: []
			});

			let origins 		= [options.pickup_latitude+","+options.pickup_longitude];
			let destinations	= [];
			let locations		= [];
			let totalLocations  = {};
			options.locations.map((locationRecords,index)=>{
				let lat = locationRecords[latitudeField] ? locationRecords[latitudeField] : "";
				let lng = locationRecords[longitudeField] ? locationRecords[longitudeField] : "";

				locationRecords.distance_in_minutes = 0;
				locationRecords.distance_in_km 		= 0;
				locationRecords.invalid 			= true;
				totalLocations[index] 				= locationRecords;
				if(lat && lng){
					locationRecords.index = index;
					locations.push(locationRecords);
					destinations.push(lat+","+lng);
				}
			});

			/** Send success response */
			if(destinations.length == 0 || origins.length == 0) return resolve({
				status 		: 	Constants.STATUS_SUCCESS,
				locations	:	Object.values(totalLocations)
			});

			/** Get distance details by google */
			distance.get({
				origins		:	origins,
				destinations: 	destinations,
				mode		: 	"driving"
			},(err, data)=>{
				if(err) console.error(err);

				/** Send error response */
				if(err) return resolve({
					status: Constants.STATUS_ERROR,
					message: res.__("system.something_going_wrong_please_try_again"),
					google_error: err
				});

				if(data.length>0){
					data.map((distanceData,distanceIndex)=>{
						let durationInSeconds 	= (distanceData.durationValue) ? distanceData.durationValue : 0;
						let distanceInMinutes 	= durationInSeconds ? Math.ceil(durationInSeconds/Constants.SECONDS_IN_A_MINUTE) : 0;
						let distanceInMeters	= 	(distanceData.distanceValue) 	? 	distanceData.distanceValue 					:0;
						let distanceInKm 		= 	durationInSeconds 				? 	Math.round(distanceInMeters/Constants.METER_IN_1_KM)	:0;
						let tmpInvalid			= 	(distanceData.invalid) 			? 	distanceData.invalid 						:false;
						let resultStatus		=	(distanceData.resultStatus) 	?	distanceData.resultStatus 					:"";
						if(locations[distanceIndex]){
							let locationIndex = locations[distanceIndex].index;
							totalLocations[locationIndex].distance_in_minutes += distanceInMinutes;
							totalLocations[locationIndex].distance_in_km 	   = distanceInKm;
							totalLocations[locationIndex].distance_in_meters   = distanceInMeters;
							totalLocations[locationIndex].resultStatus   		= resultStatus;
							totalLocations[locationIndex].google_response  = distanceData;

							delete totalLocations[locationIndex].index;

							if(!tmpInvalid){
								delete totalLocations[locationIndex].invalid;
							}
						}
					});
				}

				/** Send success response */
				resolve({
					status : Constants.STATUS_SUCCESS,
					locations: Object.values(totalLocations)
				});
			});
        }).catch(next);
	};// end getDistanceBetweenLocations()

	/**
	 * Function to update order status
	 *
	 * @param req		As Request Data
	 * @param res		As Response Data
	 * @param next		As Callback argument to the middle ware function
	 * @param options	As object data
	 *
	 * @return json
	**/
	updateOrderStatus (req,res,next,options){
		return new Promise(resolve=>{
			let orderId 	= (options.order_id) 	? 	new ObjectId(options.order_id) 	:"";
			let captainId 	= (options.user_id) 	?	new ObjectId(options.user_id)	:"";
			let orderStatus = (options.status) 		?	options.status			 	:"";

			/** Send error response */
			if(!orderId || !captainId || !orderStatus || (!Constants.DRIVER_ORDER_STATUS[orderStatus] && orderStatus != Constants.ORDER_DELIVERED)){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			/** Set captain conditions */
			let captainConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			captainConditions._id = captainId;

			const users	 =	this.db.collection(Tables.USERS);
			const orders =	this.db.collection(Tables.ORDERS);
			asyncParallel({
				order_details : (callback)=>{
					/** Set order conditions */
					let orderConditions = {
						_id			: orderId,
						is_completed: {$exists: false},
						captain_id	: ""
					};

					/** Add captain conditions */
					if(orderStatus != Constants.ORDER_DRIVER_ACCEPTED){
						orderConditions.captain_id = captainId;
					}

					/** Get order details */
					orders.findOne(orderConditions,{projection: {order_status: 1, customer_id:1,restaurant_id:1,device_id:1,}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				captain_details : (callback)=>{
					/** Get captain details */
					users.findOne(captainConditions,{projection: {orders:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				assignment_details : (callback)=>{
					if(orderStatus != Constants.ORDER_DRIVER_ACCEPTED) return callback(null,true);

					/** Get assignment details */
					const order_assignment_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
					order_assignment_logs.countDocuments({
						order_id 	:	orderId,
						captain_id 	:	captainId,
						status 		:	Constants.ORDER_DRIVER_ASSIGNED,
						cancelled_at:	{$gte: Helpers.newDate() },
					}).then(contResult=>{
						callback(null,contResult);
					}).catch(next);
				}
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let captainOrders = (asyncResponse.captain_details && asyncResponse.captain_details.orders) ? asyncResponse.captain_details.orders:[];
				if(!asyncResponse.order_details || !asyncResponse.captain_details || !asyncResponse.assignment_details || captainOrders.length <=0){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("bookings.invalid_access_or_unassigned"), asyncResponse: asyncResponse });
				}

				let orderData =	asyncResponse.order_details;
				asyncParallel({
					update_captain_details : (callback)=>{
						/** Set updated data */
						let userUpdateData = {
							$set :{
								modified : Helpers.getUtcDate()
							}
						};

						/** Update captain details  */
						users.updateOne(captainConditions,userUpdateData).then(()=>{
							callback(null);
						}).catch(next);
					},
					update_order_details : (callback)=>{
						if(orderStatus != Constants.ORDER_DRIVER_ACCEPTED) return callback(null);

						/** Set updated data */
						let orderUpdateData = {
							modified : Helpers.getUtcDate()
						};

						if(orderStatus == Constants.ORDER_DRIVER_ACCEPTED){
							orderUpdateData.captain_id = captainId;
						}

						/** Update order details  */
						orders.updateOne({_id: orderId},{$set: orderUpdateData}).then(()=>{
							callback(null);
						}).catch(next);
					},
					update_order_logs : (callback)=>{
						/** Update order assignment logs details  */
						const order_assignment_logs =	this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
						order_assignment_logs.updateMany({
							captain_id	: captainId,
							order_id	: orderId
						},
						{$set: {
							current_status 	: 	orderStatus,
							modified 		: 	Helpers.getUtcDate(),
						}}).then(()=>{
							callback(null);
						}).catch(next);
					}
				},(asyncChildErr)=>{
					if(asyncChildErr) return next(asyncChildErr);

					let message = "";
					switch(orderStatus){
						case Constants.ORDER_DELIVERED :
							message =  res.__("assignment.order_has_been_delivered_successfully");
						break;
						case Constants.ORDER_DRIVER_ACCEPTED :
							message =  res.__("assignment.order_has_been_accepted");
						break;
						case Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT :
							message =  res.__("assignment.order_status_as_marked_arrived_at_restaurant");
						break;
						case Constants.ORDER_DRIVER_WAY_TO_CUSTOMER :
							message =  res.__("assignment.order_status_as_marked_way_to_customer");
						break;
						case Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION :
							message =  res.__("assignment.order_status_as_marked_arrived_at_customer");
						break;
					}

					/** Send success response */
					resolve({status: Constants.STATUS_SUCCESS, message: message });

					/** Save order status logs */
					Helpers.saveOrderStatusLogs(req,res,next,{
						updated_by		:	captainId,
						user_id			:	orderData.customer_id,
						restaurant_id	:	orderData.restaurant_id,
						device_id		:	orderData.device_id,
						status 			:	orderStatus,
						order_status	:	orderData.order_status,
						order_id 		:	orderId,
					}).then(()=>{});
				});
			});
        }).catch(next);
	};// end updateOrderStatus()

	/**
	 * Function to get geo locations
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	getGeoLocations (req,res,next,options){
		return new Promise(resolve=>{
			let toLat	 = (options.to_lat)	   ? options.to_lat    :"";
			let toLong	 = (options.to_long)   ? options.to_long   :"";
			let fromLat	 = (options.from_lat)  ? options.from_lat  :"";
			let fromLong = (options.from_long) ? options.from_long :"";

			/** Send error response */
			if(!toLat || !toLong || !fromLat || !fromLong){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			/** Get distance */
			let distance = 	geolib.getDistance(
				{ latitude: toLat, longitude: toLong },
				{ latitude: fromLat, longitude: fromLong }
			);

			/** Send success response */
			resolve({
				status 	 : Constants.STATUS_SUCCESS,
				distance : distance
			});
        }).catch(next);
	};// end getGeoLocations()

	/***
	 * Function to save assignment process logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 */
	saveAssignmentProcessLogs (req,res,next,options){
		return new Promise(resolve=>{
			let orderId			=	(options.order_id)			?	new ObjectId(options.order_id)	:"";
			let driverIds		=	(options.driver_ids)		?	options.driver_ids			:[];
			let processId		=	(options.process_id)		?	options.process_id			:"";
			let processDetails	=	(options.assignment_process_details) ? options.assignment_process_details :{};

			if(!orderId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			if(driverIds.constructor !== Array) driverIds = [driverIds];
			driverIds	=	Helpers.arrayToObject(driverIds);

			let updatedData = {
				$set: {
					process_details : 	processDetails,
					modified 		:	Helpers.getUtcDate(),
				},
				$addToSet: {
					driver_ids : {$each: driverIds}
				},
				$setOnInsert: {
					created	: Helpers.getUtcDate(),
				}
			};

			if(options.process_error){
				updatedData["$set"].process_error = options.process_error;
			}

			/** Save order assignment process logs */
			const order_assignment_process_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_PROCESS_LOGS);
			order_assignment_process_logs.updateOne({
				order_id 	: 	orderId,
				process_id	:	processId,
			},updatedData,{upsert: true}).then(()=>{

				/** Send success response */
				resolve({ status: Constants.STATUS_SUCCESS });
			}).catch(next);
		}).catch(next);
	}; // end  saveAssignmentProcessLogs()

	/***
	 * Function to save assignment process step logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 */
	saveAssignmentProcessStepLogs (req,res,next,options){
		return new Promise(resolve=>{
			let orderId			=	(options.order_id)			?	new ObjectId(options.order_id)	:"";
			let driverIds		=	(options.driver_ids)		?	options.driver_ids			:[];
			let processId		=	(options.process_id)		?	options.process_id			:"";
			let assignmentType	=	(options.assignment_type)	?	options.assignment_type		:"";

			if(!orderId || !assignmentType || !processId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			if(driverIds.constructor !== Array) driverIds = [driverIds];
			driverIds	=	Helpers.arrayToObject(driverIds);

			/** Save order assignment process logs */
			const order_assignment_process_step_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_PROCESS_STEP_LOGS);
			order_assignment_process_step_logs.updateOne({
				order_id 		: 	orderId,
				process_id		:	processId,
				assignment_type :	assignmentType
			},
			{
				$set: {
					modified : Helpers.getUtcDate(),
				},
				$addToSet: {
					driver_ids : {$each: driverIds}
				},
				$setOnInsert: {
					created	: Helpers.getUtcDate(),
				}
			},{upsert: true}).then(()=>{

				/** Send success response */
				resolve({ status: Constants.STATUS_SUCCESS });
			}).catch(next);
		}).catch(next);
	}; // end  saveAssignmentProcessStepLogs()

	/***
	 * Function to save assignment logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 */
	saveAssignmentLogs (req,res,next,options){
		return new Promise(resolve=>{
			let orderId			=	(options.order_id)			?	new ObjectId(options.order_id)	:"";
			let processId		=	(options.process_id)		?	new ObjectId(options.process_id):"";
			let logType			=	(options.log_type)			?	options.log_type			:"";
			let pickupDetails	=	(options.pickup_details)	?	options.pickup_details		:{};
			let allCaptainIds	=	(options.all_captain_ids)	?	options.all_captain_ids		:[];

			/** Send error response */
			if(!orderId || !logType || !processId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			const saveAllDriverLogs	=	(res.locals.settings['Order_Assignment.save_all_driver_logs']) ? parseInt(res.locals.settings['Order_Assignment.save_all_driver_logs']) :0;
			let logsUpdatdData 		= 	{$set: {}};
			const users = this.db.collection(Tables.USERS);
			asyncParallel({
				process_start : (callback)=>{
					if(logType != "process_start") return callback(null);

					logsUpdatdData["$set"]["process_start_time"] = Helpers.getUtcDate();
					callback(null);
				},
				all_driver : (callback)=>{
					if(logType != "all_driver") return callback(null);

					if(saveAllDriverLogs != Constants.ACTIVE){
						logsUpdatdData["$set"]["all_drivers"] = { drivers: [], settings: saveAllDriverLogs  };
						return callback(null);
					}

					/** set user conditions */
					let userConditions 		=	clone(Constants.DRIVER_ASSIGNMENT_CONDITIONS);
					userConditions["_id"]	=	{$nin : allCaptainIds};

					let aggPipline 		=	[];
					let pickupLatitude 	= 	pickupDetails.latitude;
					let pickupLongitude =	pickupDetails.longitude;
					let restLongitude 	=	options.restaurant_longitude;
					let restLatitude	= 	options.restaurant_latitude;
					if(restLongitude && restLatitude){
						aggPipline.push({
							$geoNear: {
								near : {
									type			: 	"Point",
									coordinates		: 	[ restLongitude , restLatitude ]
								},
								distanceMultiplier	: 	1 / Constants.ONE_KMS_TO_METER,
								distanceField		: 	"query_distance",
								spherical			: 	false,
								query				: 	userConditions,
								includeLocs			:	'locs',
							}
						});
					}

					aggPipline.push({$match: userConditions});
					aggPipline.push({$project: {query_distance:1,full_name:1, driver_id: 1,active_orders: 1,latitude: 1,longitude: 1, is_available:1,order_status:1,vehicle_type:1} });

					/** Get all driver list */
					users.aggregate(aggPipline).toArray().then().then(driverList=>{
						logsUpdatdData["$set"]["all_drivers"] = driverList;

						if(driverList.length<=0){
							return callback(null, driverList);
						}

						/** Get distance  */
						this.getDistanceBetweenLocations(req,res,next,{
							locations		: driverList,
							pickup_latitude : pickupLatitude,
							pickup_longitude: pickupLongitude,
						}).then(locationResponse=>{
							if(locationResponse.status == Constants.STATUS_SUCCESS){
								logsUpdatdData["$set"]["all_drivers"] = locationResponse.locations;
							}else{
								logsUpdatdData["$set"]["all_drivers_google_error"] 	 = locationResponse;
								logsUpdatdData["$set"]["all_drivers_google_options"] = {
									pickup_latitude : pickupLatitude,
									pickup_longitude: pickupLongitude
								};
							}
							callback(null);
						});
					}).catch(next);
				},
				customer_distance : (callback)=>{
					if(logType != "customer_distance") return callback(null);

					logsUpdatdData["$set"]["customer_distance_with_google"] = options.customer_distance;
					if(options.google_error){
						logsUpdatdData["$set"]["customer_distance_with_google_error"] 	= options.google_error;
						logsUpdatdData["$set"]["customer_distance_with_google_options"] = options.google_options;
					}
					callback(null);
				},
				eligible_drivers : (callback)=>{
					if(logType != "eligible_drivers") return callback(null);

					logsUpdatdData["$push"] = {
						eligible_driver_list: {
							priority_type 	 			:	options.priority_type,
							same_customer 	 			: 	(options.same_customer) ? options.same_customer :false,
							eligible_drivers 			: 	options.eligible_drivers,
							slab_min_distance 			: 	options.slab_min_distance,
							slab_max_distance 			: 	options.slab_max_distance,
							vehicle_type 				: 	options.vehicle_type,
							remaining_preparation_time	:	options.remaining_time,
						}
					};
					callback(null);
				},
				eligible_drivers_with_google : (callback)=>{
					if(logType != "eligible_drivers_with_google") return callback(null);

					let minSlab 		=	options.slab_min_distance;
					let maxSlab 		=	options.slab_max_distance;
					let tmpVehicleType 	=	options.vehicle_type;
					let slabString		= 	"slab_"+minSlab+"_"+maxSlab;
					let priorityType	= 	(options.same_customer) ? "find_already_assigned_captains_same_customer" :options.priority_type;
					let dbKey			=	"eligible_drivers_with_google."+priorityType+"."+slabString+"."+tmpVehicleType;

					if(!logsUpdatdData["$push"]) logsUpdatdData["$push"] = {};
					logsUpdatdData["$push"][dbKey] = {
						remaining_preparation_time 	: 	options.remaining_preparation_time,
						assignment_buffer_time 		: 	options.assignment_buffer_time,
						maximum_buffer_time 		: 	options.maximum_buffer_time,
						slab_min_distance 			: 	options.slab_min_distance,
						slab_max_distance 			: 	options.slab_max_distance,
						vehicle_type 				: 	options.vehicle_type,
						log_conditions				:	options.log_conditions,
						max_order_assigned_to_captain:	options.max_order_assigned_to_captain,
						eligible_drivers 			:	options.eligible_drivers_with_google,
					}

					if(options.google_error){
						logsUpdatdData["$push"][dbKey]["google_error"]		=	options.google_error;
						logsUpdatdData["$push"][dbKey]["google_options"]	=	options.google_options;
					}
					callback(null);
				},
				assigned_driver : (callback)=>{
					if(logType != "assigned_driver") return callback(null);

					logsUpdatdData["$set"]["assigned_driver_which_priority"] = (options.captain_found_which_priority)? options.captain_found_which_priority:"";
					logsUpdatdData["$set"]["assigned_driver"] = options.assigned_driver;
					callback(null);
				},
				max_distance_reach : (callback)=>{
					if(logType != "max_distance_reach") return callback(null);

					logsUpdatdData["$addToSet"] = {
						max_distance_reach : {
							priority_type 	: 	options.priority_type,
							car_distance 	:	options.car_distance,
							total_distance 	:	options.total_distance
						}
					};
					callback(null);
				},
				distance_to_find_vechile_type : (callback)=>{
					if(logType != "distance_to_find_vechile_type") return callback(null);

					logsUpdatdData["$set"] = {
						distance_to_find_vechile_type: {
							total_distance 	: 	options.total_distance,
							driver_details	: 	options.driver_details,
							matched_location_details: options.pickup_details
						}
					};
					callback(null);
				},
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send success response */
				if(Object.keys(logsUpdatdData["$set"]).length ==0 && ((logsUpdatdData["$addToSet"] && Object.keys(logsUpdatdData["$addToSet"]).length ==0)  && (logsUpdatdData["$push"] && Object.keys(logsUpdatdData["$push"]).length ==0))){
					return resolve({ status: Constants.STATUS_SUCCESS });
				}

				logsUpdatdData["$set"].modified = Helpers.getUtcDate();
				logsUpdatdData["$setOnInsert"] = {
					created	: Helpers.getUtcDate(),
				};

				/** Save order assignment process logs */
				const order_assignment_log_steps = this.db.collection(Tables.ORDER_ASSIGNMENT_LOG_STEPS);
				order_assignment_log_steps.updateOne({
					order_id 		: 	orderId,
					process_id		:	processId,
				},logsUpdatdData,{upsert: true}).then(()=>{

					/** Send success response */
					resolve({ status: Constants.STATUS_SUCCESS });
				}).catch(next);
			});
		}).catch(next);
	}; // end  saveAssignmentLogs()
}// End Assignment