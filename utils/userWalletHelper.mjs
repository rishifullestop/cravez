import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel, eachOfSeries, forEachOf as asyncForEachOf, each as asyncEach } from 'async';

import { getDb } from '../config/connection.mjs';
import * as Constants from "../config/global_constant.mjs";
import Tables from '../config/database_tables.mjs';
import { round, getUtcDate, getUniqueId, addDate, newDate, arrayToObject } from './index.mjs';

/**
 *  Function to get wallet balance
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	Object Data
 *
 * @return object
 */
export const getWalletBalance = async (req,res,next,options={})=>{
	try{
		let userId	= new ObjectId(options.user_id);

		let dbInstance 	=	getDb();
		const userResult= await dbInstance.collection(Tables.USERS).findOne({_id: userId},{projection: {total_amount:1,wallet:1}});

		let walletTypes = {};
		Object.keys(Constants.WALLET_TYPE).map(key=>{
			walletTypes[key] = userResult?.wallet?.[key] || 0;
		});

		return {
			total_amount: userResult?.total_amount || 0,
			wallet 		: walletTypes
		};
	}catch(error){
		console.error("Error at getWalletBalance utility ",error);

		let walletTypes = {};
		Object.keys(Constants.WALLET_TYPE).map(key=>{
			walletTypes[key] = 0;
		});

		return {
			total_amount: 0,
			wallet 		: walletTypes
		};
	}
}// end getWalletBalance()

/**
 * Function to save update wallet balance and save logs in user_wallet_logs
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	Object Data
 *
 * @return object
 */
export const updateWalletBalance = async(req,res,next,options={})=>{
	return new Promise(resolve=>{
		let userId				=	(options.user_id)		?	new ObjectId(options.user_id)	:"";
		let amount				=	(options.amount)		?	round(parseFloat(options.amount)):0;
		let parentId			=	(options.parent_id)		?	new ObjectId(options.parent_id)	:"";
		let orderId				=	(options.order_id)		?	options.order_id			:"";
		let walletType			=	(options.wallet_type)	?	options.wallet_type			:"";
		let transactionType		=	(options.transaction_type)	?	options.transaction_type:Constants.DEBIT;
		let extraParameters		=	(options.extra_parameters)	?	options.extra_parameters:"";
		let isUsedPoints		=	(options.is_used_points)	?	options.is_used_points	:"";
		let notAddPoints		=	(options.not_add_points)	?	true					:false;
		let isDoubleCashback	=	(options.is_double_cashback)?	true					:false;
		let usrExpiryDate		=	(options.expiry_date)		?	options.expiry_date		:"";
		let pointsParentWalletIds=   [];
		let totalPointDebitAmount=	0;
		let restaurantId		=	"";
		let branchId			=	"";

		if(extraParameters){
			if(extraParameters.restaurant_id) restaurantId = ObjectId(extraParameters.restaurant_id);
			if(extraParameters.branch_id) branchId = new ObjectId(extraParameters.branch_id);
		}

		let dbInstance 			= 	getDb();
		let balancePriority 	= 	(res.locals.settings["wallet.debit_priority"]) ?	res.locals.settings["wallet.debit_priority"]	:"";
		let pointsPerAmount 	=	(res.locals.settings["Points_system.points_per_amount"]) ?	parseFloat(res.locals.settings["Points_system.points_per_amount"])	:0;
		let totalOrderAmount 	=	amount;
		balancePriority			=	(balancePriority) ? balancePriority.split(",") :[];

		/** Send error response **/
		if(!userId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters") });
		if(transactionType == Constants.DEBIT && balancePriority.length <=0) return resolve({ status: Constants.STATUS_ERROR, message:	res.__("system.something_going_wrong_please_try_again"), debit_priority:false });

		asyncParallel({
			check_cashback : (cashBackCallback)=>{
				if(transactionType != Constants.DEBIT || !branchId || !restaurantId)return cashBackCallback(null,{});

				/** Check branch accept cashback payment */
				const restaurant_branch_attributes	= dbInstance.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
				restaurant_branch_attributes.find({
					attribute_id : 	{$in: [
						Constants.BRANCH_ACCEPTS_CASHBACK_PAYMENT_ATTRIBUTE_ID,
						Constants.BRANCH_ACCEPTS_CASHBACK_FROM_OTHER_RESTAURANT_ATTRIBUTE_ID,
						Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID
					]},
					branch_id	 :	branchId,
					restaurant_id:	restaurantId,
				},{projection : {attribute_id: 1,value: 1}}).toArray().then(attributeResult=>{
					let giveCashBack 				= false;
					let acceptCashBack 				= false;
					let acceptOtherBranchCashBack 	= false;
					if(attributeResult && attributeResult.length >0){
						attributeResult.map(records=>{
							if(records.attribute_id == Constants.BRANCH_ACCEPTS_CASHBACK_PAYMENT_ATTRIBUTE_ID){
								acceptCashBack = (records.value && parseInt(records.value) == Constants.ACCEPT) ? true: false;
							}
							if(records.attribute_id == Constants.BRANCH_ACCEPTS_CASHBACK_FROM_OTHER_RESTAURANT_ATTRIBUTE_ID){
								acceptOtherBranchCashBack = (records.value && parseInt(records.value) == Constants.ACCEPT) ? true: false;
							}
							if(records.attribute_id == Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID){
								giveCashBack = (records.value && parseInt(records.value) == Constants.ACCEPT) ? true: false;
							}
						});
					}
					cashBackCallback(attributeErr,{
						accept_cash_back 				: acceptCashBack,
						give_cash_back 					: giveCashBack,
						accept_other_branch_cash_back 	: acceptOtherBranchCashBack,
					});
				}).catch(next);
			}
		},(parentParallelErr,parentParallelResponse)=>{
			if(parentParallelErr) return next(parentParallelErr);

			let branchGiveCashBack 				= false;
			let branchAcceptCashBack 			= false;
			let branchAcceptOtherBranchCashBack = false;
			if(parentParallelResponse.check_cashback){
				branchAcceptCashBack 			= parentParallelResponse.check_cashback.accept_cash_back;
				branchAcceptOtherBranchCashBack = parentParallelResponse.check_cashback.accept_other_branch_cash_back;
				branchGiveCashBack	 = parentParallelResponse.check_cashback.give_cash_back;
			}

			const users	= dbInstance.collection(Tables.USERS);
			asyncParallel({
				wallet_details : (walletCallback)=>{
					if(transactionType == Constants.DEBIT){
						/* Get user current balance */
						getWalletBalance(req,res,next,{ user_id: userId}).then((walletBalance)=>{

							let totalWalletBalance	=	walletBalance.total_amount;
							let tempAmount		 	=  	amount;
							let walletDetails	 	=	walletBalance.wallet;
							let processCompleted 	= 	false;
							let walletLogsCondition =	 {};
							let walletIsExceed		=	(totalWalletBalance <= amount) ? true :false;
							let decreasedAmount 	= {
								total_amount : (walletIsExceed) ? -totalWalletBalance :-amount
							};

							asyncParallel({
								debite_points : (parallelSubCallback)=>{
									if(!isUsedPoints) return parallelSubCallback(null);

									/** Set options */
									let debitOptions = {
										user_id			: 	userId,
										amount			: 	tempAmount,
										wallet_type		: 	Constants.POINTS_AMOUNT,
										order_id		:	orderId,
										branch_id		:	branchId,
										restaurant_id	:	restaurantId,
										accept_other_branch_cashback :	branchAcceptOtherBranchCashBack
									};

									debitPointsAmount(req,res,next,debitOptions).then(debitResponse=>{
										if(debitResponse.status !=Constants.STATUS_SUCCESS) return parallelSubCallback(debitResponse);


										/**Insert parent wallet log ids which used to debit points amount */
										let subPoints	 	=	debitResponse.points;
										let pointsAmount	 = 	debitResponse.amount;
										let parentWalletIds  = 	(debitResponse.parent_wallet_id) ? debitResponse.parent_wallet_id :[];
										pointsParentWalletIds =  pointsParentWalletIds.concat(parentWalletIds);

										/* If user points amount is greator then remaining requested amount */
										if(pointsAmount >= tempAmount){
											decreasedAmount["wallet."+Constants.POINTS_AMOUNT] 	= -subPoints;
											walletLogsCondition[Constants.POINTS_AMOUNT] 		= subPoints;
											tempAmount	=	0;
											processCompleted	=	true;
										}else if(pointsAmount){
											decreasedAmount["wallet."+Constants.POINTS_AMOUNT] = -subPoints;
											walletLogsCondition[Constants.POINTS_AMOUNT] 	 =  subPoints;
											tempAmount -=  pointsAmount;
										}

										totalPointDebitAmount += pointsAmount;
										if(pointsAmount && !walletIsExceed){
											decreasedAmount.total_amount = decreasedAmount.total_amount+pointsAmount;
										}
										parallelSubCallback(null);
									}).catch(next);
								}
							},(parallelSubErr)=>{
								if(parallelSubErr) return walletCallback(parallelSubErr);

								eachOfSeries(balancePriority,(tmpWalletType, index, seriesCallback)=>{
									if(processCompleted || tmpWalletType == Constants.POINTS_AMOUNT) return seriesCallback(null);

									let currentWalletAmount = (walletDetails[tmpWalletType]) ? walletDetails[tmpWalletType] :0;

									if(tmpWalletType == Constants.CASHBACK_AMOUNT){
										if(tmpWalletType == Constants.CASHBACK_AMOUNT  && !branchAcceptCashBack) return seriesCallback(null);

										debitPointsAmount(req,res,next,{user_id: userId,amount: tempAmount, wallet_type: tmpWalletType, order_id: orderId}).then(debitResponse=>{
											if(debitResponse.status !=Constants.STATUS_SUCCESS) return seriesCallback(debitResponse);

											/**Insert parent wallet log ids which used to debit points amount */
											let pointsPoints	 =	debitResponse.points;
											let pointsAmount	 = 	debitResponse.amount;
											let parentWalletIds  = 	(debitResponse.parent_wallet_id) ? debitResponse.parent_wallet_id :[];
											pointsParentWalletIds =  pointsParentWalletIds.concat(parentWalletIds);
											let debitedAmount	 =  (tmpWalletType == Constants.POINTS_AMOUNT) ? pointsPoints:pointsAmount;

											/* If user points amount is greator then remaining requested amount */
											if(pointsAmount >= tempAmount){
												decreasedAmount["wallet."+tmpWalletType] 	= -debitedAmount;
												walletLogsCondition[tmpWalletType] 			= debitedAmount;
												tempAmount									=	0;
												processCompleted	=	true;
											}else if(pointsAmount){
												decreasedAmount["wallet."+tmpWalletType] = -debitedAmount;
												walletLogsCondition[tmpWalletType] 	 	 =  debitedAmount;
												tempAmount 								-=  pointsAmount;
											}

											if(tmpWalletType == Constants.POINTS_AMOUNT && pointsAmount){
												decreasedAmount.total_amount = decreasedAmount.total_amount+pointsAmount;
											}
											seriesCallback(null);
										}).catch(next);
									}else{
										/* If user amount is greator then requested amount */
										if(currentWalletAmount >= tempAmount){
											decreasedAmount["wallet."+tmpWalletType]= 	-tempAmount;
											walletLogsCondition[tmpWalletType] 		= 	tempAmount;
											tempAmount								=	0;
											processCompleted	=	true;
										}else if(currentWalletAmount){
											decreasedAmount["wallet."+tmpWalletType] = -currentWalletAmount;
											walletLogsCondition[tmpWalletType] 	 	 =  currentWalletAmount;
											tempAmount 								-=  currentWalletAmount;
										}
										seriesCallback(null);
									}
								},seriesEachErr=>{
									if(seriesEachErr) return walletCallback(seriesEachErr);

									walletCallback(null,{
										update_conditions: decreasedAmount,
										wallet_logs_condition: walletLogsCondition,
										remaining_amount: tempAmount
									});
								});
							});
						}).catch(next);
					}else{
						let increasedAmount 	= {};
						let walletLogsCondition = {};

						if(walletType != Constants.POINTS_AMOUNT) increasedAmount.total_amount = amount;

						increasedAmount["wallet."+walletType]	= amount;
						walletLogsCondition[walletType]			= amount;

						walletCallback(null,{ update_conditions: increasedAmount, wallet_logs_condition: walletLogsCondition });
					}
				},
			},async(parallelErr,parallelResponse)=>{
				if(parallelErr) return next(parallelErr)

				let updateWalletConditions 	= (parallelResponse.wallet_details.update_conditions) ? parallelResponse.wallet_details.update_conditions :{};
				let walletLogsConditions 	= (parallelResponse.wallet_details.wallet_logs_condition) ? parallelResponse.wallet_details.wallet_logs_condition:{};
				let remainingAmount 		= (parallelResponse.wallet_details.remaining_amount) ? parallelResponse.wallet_details.remaining_amount :0;

				/** Send success response **/
				if(Object.keys(updateWalletConditions).length <=0 || Object.keys(walletLogsConditions).length<=0){
					return resolve({
						status 	:	Constants.STATUS_SUCCESS,
						remaining_amount: remainingAmount,
						points_amount	: totalPointDebitAmount,
					});
				}

				try{
					let uniqueResponse = await getUniqueId(req,res,next,{type : "user_wallet_logs"});
					let transactionId = uniqueResponse?.result || "";

					/** Set user update details */
					let userUpdatedData = {
						$set : { modified_at: getUtcDate() },
						$inc : updateWalletConditions
					};

					/** Update wallet balance in users */
					await users.updateOne({_id : new ObjectId(userId)},userUpdatedData);



					/** Save user wallet logs **/
					const user_wallet_logs =	dbInstance.collection(Tables.USER_WALLET_LOGS);
					asyncForEachOf(walletLogsConditions,(walletAmount,walletLogType, walletLogCallback)=>{
						let dataToBeSavedInLogs = {
							transaction_id	: transactionId,
							user_id			: userId,
							parent_id		: parentId,
							transaction_type: transactionType,
							wallet_type		: walletLogType,
							amount			: walletAmount,
							created			: getUtcDate(),
						};

						if(orderId) dataToBeSavedInLogs.order_id = orderId;

						let tempExtraParameters = clone(extraParameters);

						/**Add expiry date if points is credited */
						if((walletLogType == Constants.POINTS_AMOUNT || walletLogType == Constants.CASHBACK_AMOUNT) && transactionType ==  Constants.CREDIT){
							let pointsExpiryDays = 0;
							if(walletLogType == Constants.POINTS_AMOUNT){
								pointsExpiryDays = (res.locals.settings["Points_system.validity"]) ?	parseInt(res.locals.settings["Points_system.validity"])	:0;
							}
							if(walletLogType == Constants.CASHBACK_AMOUNT){
								pointsExpiryDays = (res.locals.settings["Points_system.validity"]) ?	parseInt(res.locals.settings["Points_system.validity"])	:0;
							}

							let hoursToBeAdd	= pointsExpiryDays * Constants.HOURS_IN_A_DAY;
							let pointsExpiryDate = getUtcDate(newDate(addDate(hoursToBeAdd),Constants.DATABASE_DATE_FORMAT));

							if(!tempExtraParameters) tempExtraParameters = {};
							tempExtraParameters.expiry_date = (usrExpiryDate) ? usrExpiryDate :getUtcDate(pointsExpiryDate+" "+Constants.END_DATE_TIME_FORMAT);

							dataToBeSavedInLogs["remaining_amount"] = walletAmount;
						}

						/** if points amount deducted save parent wallet log ids */
						if((walletLogType == Constants.POINTS_AMOUNT || walletLogType == Constants.CASHBACK_AMOUNT) && (transactionType ==  Constants.DEBIT && pointsParentWalletIds.length>0)){
							if(!tempExtraParameters) tempExtraParameters= {};
							tempExtraParameters.parent_wallet_id = arrayToObject(pointsParentWalletIds);
						}

						if(tempExtraParameters){
							dataToBeSavedInLogs["extra_parameters"] = tempExtraParameters;
						}

						/** Save log details */
						user_wallet_logs.insertOne(dataToBeSavedInLogs).then(()=>{
							walletLogCallback(null);
						}).catch(next);
					},(eachOfAsyncErr)=>{
						if(eachOfAsyncErr) return next(eachOfAsyncErr);

						let totalCreditPoints  =  0;
						if(totalOrderAmount >0){
							totalCreditPoints = round((totalOrderAmount-totalPointDebitAmount)*pointsPerAmount);
						}

						/** Add points in wallet */
						if(branchGiveCashBack && !notAddPoints && totalCreditPoints >0 && transactionType ==  Constants.DEBIT){
							if(isDoubleCashback){
								totalCreditPoints += totalCreditPoints;
								if(!extraParameters) extraParameters = {};
								extraParameters.is_double_cashback = isDoubleCashback;
							}

							/** Set points options */
							let creditOptions = {
								user_id 		:	userId,
								amount 			: 	totalCreditPoints,
								wallet_type  	: 	Constants.POINTS_AMOUNT,
								transaction_type: 	Constants.CREDIT,
								order_id		: 	orderId,
								extra_parameters:	extraParameters,
							};

							/** Add points in wallet */
							updateWalletBalance(req,res,next,creditOptions).then(creditResponse=>{
								creditResponse.transaction_id 	= transactionId;
								creditResponse.remaining_amount = remainingAmount;
								resolve(creditResponse);
							}).catch(next);
						}else{
							/** Send success response **/
							resolve({
								status			: Constants.STATUS_SUCCESS,
								transaction_id	: transactionId,
								remaining_amount: remainingAmount,
								points_amount	: totalPointDebitAmount,
							});
						}
					});
				}catch(err){
					return next(err);
				}
			});
		});
	});
}// end updateWalletBalance()

/**
 *  Function to debit points amount
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	Object Data
 *
 * @return object
 */
export const debitPointsAmount = (req,res,next,options)=>{
	return new Promise(resolve=>{
		let userId					= (options.user_id) 	? new ObjectId(options.user_id)  	:"";
		let amountToBeDeduct		= (options.amount) 		? parseFloat(options.amount)	:0;
		let walletType				= (options.wallet_type) ? options.wallet_type 		 	:"";
		let orderId					= (options.order_id) 	? options.order_id 		 		:"";
		let branchId				= (options.branch_id) 	? options.branch_id 		 	:"";
		let restaurantId			= (options.restaurant_id)? options.restaurant_id 		:"";
		let acceptOtherBranchCashback= (options.accept_other_branch_cashback) 	? options.accept_other_branch_cashback :false;

		let remainingAmountToDeduct	= amountToBeDeduct;
		let currentDate 			= newDate("",Constants.DATABASE_DATE_FORMAT);
		let startDate   			= getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);

		let percentage 		=	(res.locals.settings["Points_system.max_point_usage"]) ?	parseFloat(res.locals.settings["Points_system.max_point_usage"])	:0;
		let amountPerPoints =	(res.locals.settings["Points_system.amount_per_points"]) ?	parseFloat(res.locals.settings["Points_system.amount_per_points"])	:0;
		let minimumValueForOrder =	(res.locals.settings["Points_system.minimum_value_for_order"]) ?	parseFloat(res.locals.settings["Points_system.minimum_value_for_order"])	:0;

		/** Set wallet conditions */
		let walletConditions = {
			user_id 						: new ObjectId(userId),
			wallet_type						: walletType,
			transaction_type				: Constants.CREDIT,
			remaining_amount				: {$gt : 0},
			"extra_parameters.is_expired"	: {$exists : false},
			$and :[
				{$or	: [
					{order_id : {$exists: false}},
					{order_id : {$ne: orderId}},
				]},
				{$or	: [
					{"extra_parameters.from_date" : {$exists: false}},
					{"extra_parameters.from_date" : {$gte: startDate}},
					{"extra_parameters.from_date" : {$lte: startDate}},
				]}
			]
		};

		if(!acceptOtherBranchCashback && restaurantId && branchId){
			walletConditions["$and"].push({"extra_parameters.restaurant_id": restaurantId });
			walletConditions["$and"].push({"extra_parameters.branch_id": branchId });
		}

		/** Get log details */
		let dbInstance = getDb();
		const user_wallet_logs	= dbInstance.collection(Tables.USER_WALLET_LOGS);
		user_wallet_logs.find(walletConditions,{projection: {
			_id: 1,remaining_amount: 1,amount: 1, wallet_type: 1, extra_parameters:1
		}}).sort({"extra_parameters.expiry_date": Constants.SORT_ASC}).toArray().then(result=>{

			let totalDebitAmount = 0;
			let totalPoints 	 = 0;

			if(result.length <=0) return resolve({status : Constants.STATUS_SUCCESS, amount: totalDebitAmount, points :totalPoints});

			let walletLogIds = [];
			asyncEach(result,(records, asyncCallback)=>{
				let remainingAmount = (records.remaining_amount) ? parseFloat(records.remaining_amount) : 0;

				if(records.extra_parameters && records.extra_parameters.order_criteria){
					let orderCriteria 		= records.extra_parameters.order_criteria;
					let orderCriteriaAmount = records.extra_parameters.order_criteria_amount;
					if(orderCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_LESS_THAN){
						if(!(remainingAmountToDeduct < orderCriteriaAmount)) return asyncCallback(null);
					}
					if(orderCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN){
						if(!(remainingAmountToDeduct > orderCriteriaAmount)) return asyncCallback(null);
					}
					if(orderCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_LESS_THAN_EQUAL_TO){
						if(!(remainingAmountToDeduct <= orderCriteriaAmount)) return asyncCallback(null);
					}
					if(orderCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN_EQUAL_TO){
						if(!(remainingAmountToDeduct >= orderCriteriaAmount)) return asyncCallback(null);
					}
				}

				if(remainingAmountToDeduct > 0){
					let updateData 	= {};

					if(records.wallet_type == Constants.POINTS_AMOUNT){
						if(amountToBeDeduct >= minimumValueForOrder){
							let totalUsedAbledPoints= round((remainingAmount*percentage)/100);
							let totalPointsAmount	= totalUsedAbledPoints*amountPerPoints;
							let tmpRemainingAmount 	= round((totalPointsAmount - remainingAmountToDeduct));
							let notUsedPoints 		= 0;
							totalPoints			 	= +totalUsedAbledPoints;

							if(tmpRemainingAmount >0){
								notUsedPoints= round(tmpRemainingAmount/amountPerPoints);
							}

							/** if amount to deduct is less than equal to amount in database */
							if(remainingAmountToDeduct <= totalPointsAmount){
								let amountToUpdate 		= round((remainingAmount - totalUsedAbledPoints+notUsedPoints));
								totalPoints				-= notUsedPoints;

								updateData.remaining_amount = amountToUpdate;
								totalDebitAmount 			+= remainingAmountToDeduct;
								remainingAmountToDeduct		= 0;
							}

							/** if amount to deduct is more than amount in database */
							if(remainingAmountToDeduct > totalPointsAmount){
								let amountToUpdate 		= round((remainingAmount - totalUsedAbledPoints+notUsedPoints));
								remainingAmountToDeduct = round((remainingAmountToDeduct - totalPointsAmount));
								updateData.remaining_amount = amountToUpdate;
								totalDebitAmount += totalPointsAmount;
							}
						}
					}else{
						/** if amount to deduct is less than equal to amount in database */
						if(remainingAmountToDeduct <= remainingAmount){
							let amountToUpdate = round((remainingAmount - remainingAmountToDeduct));
							updateData.remaining_amount = amountToUpdate;
							totalDebitAmount 			+= remainingAmountToDeduct;
							remainingAmountToDeduct		= 0;
						}

						/** if amount to deduct is more than amount in database */
						if(remainingAmountToDeduct > remainingAmount){
							remainingAmountToDeduct = round((remainingAmountToDeduct - remainingAmount));
							updateData.remaining_amount = 0;
							totalDebitAmount 			+= remainingAmount;
						}
					}

					/**Push record id in array to save as parent ids */
					if(Object.keys(updateData).length >1){
						walletLogIds.push(ObjectId(records._id));
					}

					/** Update wallet logs */
					user_wallet_logs.updateOne({
						_id : new ObjectId(records._id)
					},{$set : updateData}).then(()=>{
						asyncCallback(null);
					}).catch(next);
				}else{
					asyncCallback(null);
				}
			},(asyncErr)=>{
				if(asyncErr){
					console.error(asyncErr);
					return resolve({status : Constants.STATUS_ERROR});
				}

				/** Send response */
				resolve({
					status	: Constants.STATUS_SUCCESS,
					parent_wallet_id: walletLogIds,
					amount	:	totalDebitAmount,
					points 	:	totalPoints
				});
			});
		});
	});
}// end debitPointsAmount()

/**
 *  Function to debit balance from perticular type of wallet
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param options	As 	Object Data
 *
 * @return object
 */
export const debitWalletBalance = async (req,res,next,options)=>{
	let userId			= (options.user_id)			? new ObjectId(options.user_id)		:"";
	let amount			= (options.amount)			? round(parseFloat(options.amount))	:0;
	let parentId		= (options.parent_id)		? new ObjectId(options.parent_id)	:"";
	let walletType		= (options.wallet_type)		? options.wallet_type				:"";
	let extraParameters	= (options.extra_parameters)? options.extra_parameters			:{};
	let isExpireCron	= (options.is_expire_cron)	? options.is_expire_cron			:false;

	/** Send error response **/
	if(!userId || !walletType){
		return {status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters") };
	}

	/** Get user balance */
	let walletBalance = await getWalletBalance(req,res,next,{user_id: userId});

	/** Send error response **/
	if(!walletBalance?.wallet?.[walletType]){
		return {status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
	}

	/** Send error response **/
	if(amount > walletBalance.wallet[walletType]){
		return {status: Constants.STATUS_ERROR, message: res.__("admin.user.insufficient_fund_in_user_wallet") };
	}

	/** Set user wallet update data */
	let decreasedAmount = {
		total_amount : (walletType != Constants.POINTS_AMOUNT) ? -amount :0,
	};
	decreasedAmount["wallet."+walletType] = -amount;

	/** Update user wallet */
	const dbInstance = getDb();
	const users		 = dbInstance.collection(Tables.USERS);
	await users.updateOne({_id : userId},{$inc : decreasedAmount });

	/** Get unique transaction id **/
	let uniqueResponse = await getUniqueId(req,res,next,{type: "user_wallet_logs"});

	/** Send error response */
	if(uniqueResponse.status != Constants.STATUS_SUCCESS) return uniqueResponse;

	/** Save user wallet logs */
	const user_wallet_logs = dbInstance.collection(Tables.USER_WALLET_LOGS);
	await user_wallet_logs.insertOne({
		transaction_id	: uniqueResponse.result,
		user_id			: userId,
		transaction_type: Constants.DEBIT,
		wallet_type		: walletType,
		extra_parameters: extraParameters,
		amount			: amount,
		created			: getUtcDate(),
	});

	/** Send success response */
	return { status: Constants.STATUS_SUCCESS };
};// end debitWalletBalance()

/**
 *  Function to check order amount deduct from payment Gateway/Wallet
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	Object Data
 *
 * @return object
 */
export const callRefundAmount = (req,res,next,amountResponse)=>{
	return new Promise(resolve=>{
		let orderId 	        = (amountResponse.order_id)     	? amountResponse.order_id :"";
		let orderUserId 	    = (amountResponse.user_id)      	? amountResponse.user_id :"";
		let orderDeviceId 	    = (amountResponse.device_id)   		? amountResponse.device_id :"";
		let orderByGuest 	    = (amountResponse.is_guest)     	? amountResponse.is_guest :"";
		let totalRefundAmount 	= (amountResponse.total_refund) 	? amountResponse.total_refund : 0;
		let totalAmount 		= (amountResponse.total_amount) 	? amountResponse.total_amount : 0;
		let uniqueOrederId 		= (amountResponse.unique_order_id) 	? amountResponse.unique_order_id : 0;
		let walletType 			= (amountResponse.wallet_type) 		? amountResponse.wallet_type :Constants.REFUND_AMOUNT;
		let refundActivityType=(amountResponse.refund_activity_type)?amountResponse.refund_activity_type :"";

		let fetchAmountData	=	{
			order_id	: 	orderId,
			user_id 	: 	orderUserId,
			device_id	:	orderDeviceId,
			is_guest	:	orderByGuest,
		};
		checkOrderAmountDeductFrom(req,res,next,fetchAmountData).then(fetchAmountResponse=>{
			if(fetchAmountResponse.status != Constants.STATUS_SUCCESS) return resolve(fetchAmountResponse);

			let paymentGateway 	= fetchAmountResponse?.result?.payment_gateway || 0;
			let walletAmount 	= fetchAmountResponse?.result?.wallet_section || 0;
			let refundDetail	= [];

			if(paymentGateway.amount > 0  && walletAmount > 0){
				refundDetail.push({
					'type'	 : Constants.WALLET_PAYMENT,
					'amount' : totalRefundAmount
				});
			}else if(paymentGateway.amount >0 && walletAmount == 0){
				let paymentMethod=	(paymentGateway.payment_method) ? paymentGateway.payment_method : "";
				let transactionId=	(paymentGateway.transaction_id) ? paymentGateway.transaction_id : "";
				let gatewayType	 =	(paymentGateway.gateway_type) ? paymentGateway.gateway_type : "";
				
				refundDetail.push({
					'transaction_id': transactionId,
					'type'			: paymentMethod,
					'amount' 		: totalRefundAmount,
					'gateway_type' 	: gatewayType
				});
			}else{
				refundDetail.push({
					'type'	 : Constants.WALLET_PAYMENT,
					'amount' : totalRefundAmount
				});
			}

			if(refundDetail.length > 0){
				refundAmount(req,res,next,{
					order_id			:	orderId,
					total_amount		:	totalAmount,
					unique_order_id		:	uniqueOrederId,
					refund_detail		: 	refundDetail,
					user_id 			: 	orderUserId,
					device_id 			: 	orderDeviceId,
					payment_type		:	Constants.ORDER_REFUND_PAYMENT,
					wallet_type			:	walletType,
					refund_activity_type: 	refundActivityType,
				}).then(()=>{
					resolve({status: Constants.STATUS_SUCCESS});
				}).catch(next);
			}else{				
				resolve({status: Constants.STATUS_SUCCESS});
			}
		}).catch(next);
	}).catch(next);
};//end callRefundAmount()

/**
 *  Function to check order amount deduct from payment Gateway/Wallet
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	Object Data
 *
 * @return object
 */
export const checkOrderAmountDeductFrom = (req,res,next,options)=>{
	return new Promise(resolve=>{
		let orderId		= (options.order_id) ? new ObjectId(options.order_id) :"";
		let userId		= (options.user_id) ? new ObjectId(options.user_id)   :"";
		let deviceId	= (options.device_id) ? options.device_id   :"";
		 
		let db = getDb();
		asyncParallel({
			payment_gateway : (callback)=>{
				/** Set conditions */
				let conditions	=	{order_ids :  {$in : [orderId]}};				
				if(userId){
					conditions['user_id'] = userId;
				}else{
					conditions['device_id'] = deviceId;
				}
				
				/*If Amount Refund in payment gate way */
				const payment_transactions	=	db.collection(Tables.PAYMENT_TRANSACTIONS);
				payment_transactions.findOne(conditions,{projection:{user_id:1,transaction_id:1,amount:1,payment_method:1,gateway_type:1}}).then(paymentResult=>{
					callback(null,paymentResult);
				}).catch(next);
			},
			wallet_section : (callback)=>{
				let conditions	=	{
					transaction_type				: Constants.DEBIT,
					"extra_parameters.order_id" 	: orderId,
					"extra_parameters.order_placed" : true,
				};
				if(userId) conditions['user_id'] = new ObjectId(userId);
				
				const user_wallet_logs	=	db.collection(Tables.USER_WALLET_LOGS);
				user_wallet_logs.find(conditions,{projection:{user_id:1,amount:1}}).toArray().then(walletResult=>{
					let amount = 0;
					if(walletResult && walletResult.length > 0){
						walletResult.map((result)=>{
							amount	+=	(result.amount) ? result.amount : 0;
						});
					}
					callback(null,amount);
				}).catch(next);
			}
		},(asyncErr,asyncResponse)=>{
			if(asyncErr) return resolve({status: Constants.STATUS_ERROR});

			let onlineAmount = asyncResponse.payment_gateway;
			let walletAmount = asyncResponse.wallet_section;
			let responseData = {payment_gateway: 0, wallet_section : onlineAmount+walletAmount}
			resolve({status: Constants.STATUS_SUCCESS, result: responseData});
		});
	});
}// end checkOrderAmountDeductFrom()

/**
 * Function is used to refund/outstanding payment logs save in table
 *
 * @param classes as a array
 *
 * @return class name
 */
export const refundAmount = (req,res,next,requestedData)=>{
	return new Promise(resolve=>{
		let orderId     =   (requestedData.order_id)	?	requestedData.order_id		:"";
		let packageId   =   (requestedData.package_id)	?	requestedData.package_id	:"";
		let userId		= 	(requestedData.user_id)		?	requestedData.user_id		:"";
		let deviceId	= 	(requestedData.device_id)	?	requestedData.device_id		:"";
		let paymentType	=	(requestedData.payment_type)?requestedData.payment_type :Constants.ORDER_REFUND_PAYMENT;
		let totalAmount		= 	(requestedData.total_amount)	?	requestedData.total_amount		:0;
		let uniqueOrderId	= 	(requestedData.unique_order_id)	?	requestedData.unique_order_id	:"";
		let refundActivityType= (requestedData.refund_activity_type)?requestedData.refund_activity_type:"";
		let refundDetails		= 	(requestedData.refund_detail)	?	requestedData.refund_detail	:[];
		let walletType 	= (requestedData.wallet_type) ? requestedData.wallet_type :Constants.REFUND_AMOUNT;

		if(!orderId && !packageId){
			return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
		}

		if(refundDetails && refundDetails.length > 0){
			let saveData = {
				user_id				:	userId,
				device_id			:	deviceId,
				payment_type		:	paymentType,
				status				:	Constants.REFUND_INITIALIZE,
				payment_detail		:	refundDetails,
				unique_order_id		:	uniqueOrderId,
				refund_activity_type:	refundActivityType,
				total_amount		:	totalAmount,
				wallet_type			:	walletType,
				created 			: 	getUtcDate()
			}

			let db = getDb();
			const payment_refund_logs = db.collection(Tables.PAYMENT_REFUND_LOGS);
			if(paymentType == Constants.PACKAGE_REFUND_PAYMENT){
				payment_refund_logs.updateOne({package_id: new ObjectId(packageId) },{$set: saveData},{upsert:true}).then(()=>{
					resolve({status: Constants.STATUS_SUCCESS});
				}).catch(next);
			}else{
				payment_refund_logs.updateOne({order_id: new ObjectId(orderId)},{$set: saveData},{upsert:true}).then(()=>{
					resolve({status: Constants.STATUS_SUCCESS});
				}).catch(next);
			}
		}
	});
}//end refundAmount()

/**
 * Function is used to refund payment to users
 *
 * @param classes as a array
 *
 * @return class name
 */
export const paymentRefundProcess = (req,res,next,requestedData)=>{
	return new Promise(resolve=>{
        let baseURL		= 	res.locals.settings['Payment.myfatoorah_base_url'];
		let token		= 	res.locals.settings['Payment.myfatoorah_token'];
		let orderId     =  	requestedData?.order_id || "";
		let refundDetails=	requestedData?.refund_detail || [];
		let userId		= 	requestedData?.user_id || "";
		let refundId	= 	requestedData?.refund_id || "";
		let walletType	= 	requestedData?.wallet_type || "";

		let gatewayResponse = {
			payment_response: null,
			wallet_response : null
		};

		if(refundDetails && refundDetails.length > 0){
			asyncEach(refundDetails,(refundData, asyncEachCallback)=>{
				/**Set variable for refund amount */
				let refundType  	= (refundData.type) 			? 	refundData.type 			:"";
				let refundAmount   	= (refundData.amount)  			? 	refundData.amount 			:0;
				let transactionKey  = (refundData.transaction_id)	? 	refundData.transaction_id	:"";
				let comment   		= (refundData.comment)   		? 	refundData.comment 			:"";
				let isPaid   		= (refundData.is_paid)   		?	refundData.is_paid 			:false;

				asyncParallel({
					payment_gateway : (callback)=>{
						if((Constants.ONLINE_PAYMENT.indexOf(refundType) == -1) || (refundAmount == 0) || transactionKey == "" || isPaid) return callback(null,"");

						/*If Amount Refund in payment gate way */
						axios({
							method: 'POST',
							url: baseURL+'/v2/MakeRefund',
							headers: {
								Accept: 'application/json',
								Authorization: token,
								'Content-Type': 'application/json'
							},
							data: {
								"Key": transactionKey,
								"KeyType": "paymentId",
								"RefundChargeOnCustomer": true,
								"ServiceChargeOnCustomer": true,
								"Amount": refundAmount,
								"Comment": comment
							}
						}).then(response=>{
							if(response?.data?.IsSuccess) return callback(null,response);
							callback(null,null);
						}).catch(next);
					},
					wallet_section : (callback)=>{
						if(refundType != Constants.WALLET_PAYMENT || refundAmount == 0 || isPaid) return callback(null,"");

						/** update wallet balance */
						updateWalletBalance(req,res,next,{
							transaction_type : Constants.CREDIT,
							wallet_type      : (walletType) ? walletType :Constants.REFUND_AMOUNT,
							amount           : refundAmount,
							user_id          : new ObjectId(userId),
							extra_parameters : {
								order_id:	new ObjectId(orderId)
							}
						}).then(creditResponse=>{
							if(creditResponse.status != Constants.STATUS_SUCCESS) return callback(creditResponse.message);
							callback(null,creditResponse);
						}).catch(next);
					},
				},(asyncError,asyncRes)=>{
					if(asyncError) return asyncEachCallback(asyncError);

					if(asyncRes?.wallet_section)  gatewayResponse.wallet_response = asyncRes.wallet_section;
					if(asyncRes?.payment_gateway) gatewayResponse.payment_response = asyncRes.payment_gateway;

					asyncEachCallback(null);
				});
			},(asyncErr)=>{
				if(asyncErr) return resolve({ status: Constants.STATUS_ERROR, message:res.__("admin.system.something_going_wrong_please_try_again")});
				resolve({status: Constants.STATUS_SUCCESS,gateway_response : gatewayResponse});
			});
		}else{
			resolve({status: Constants.STATUS_SUCCESS,gateway_response : gatewayResponse});
		}
    });
}//End paymentRefundProcess()