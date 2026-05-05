import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Cron from "./model/cron.mjs";
import Tables from "../../../config/database_tables.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import distance from '../../../vendor/google-distance/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure Crons routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(app, { db }) {
    const modulePath = Constants.FRONT_END_NAME + "crons";
    const CronModule = new Cron(db);

    // Set views for all routes
    app.use(modulePath, (req, res, next) => {
        /** Set current view folder **/
		req.rendering.views	=	__dirname + "/views";
		req.rendering.layout = false;
		next();
    });

	/** Routing is used to update user leave **/
	app.get(modulePath+"/update_user_leave",(req, res,next)=>{
		CronModule.updateUserLeave(req, res,next);
	});

	/** Routing is used to lapse user leave **/
	app.get(modulePath+"/lapse_user_leave",(req, res,next)=>{
		CronModule.lapseUserLeave(req, res,next);
	});

	/** Routing is used to update remianing package days **/
	app.get(modulePath+"/update_package_days",(req, res,next)=>{
		CronModule.updatePackageDays(req, res,next);
	});

	/** Routing is used to send scheduled email/sms/notification **/
	app.get(modulePath+"/send_scheduled_notifications",(req, res,next)=>{
		CronModule.sendScheduledNotifications(req, res,next);
	});

	/** Routing is used to start driver excuses **/
	app.get(modulePath+"/start_driver_excuses",(req, res,next)=>{
		CronModule.startDriverExcuses(req, res,next);
	});

	/** Routing is used to save open branch  list **/
	app.get(modulePath+"/save_open_branchs",(req, res,next)=>{
		CronModule.saveOpenBranchList(req, res,next);
	});

	/** Routing is used to save branch open status **/
	app.get(modulePath+"/save_branch_open_status",(req, res,next)=>{
		CronModule.saveBranchOpenStatus(req, res,next);
	});

	/** Routing is used to update order rules status **/
	app.get(modulePath+"/update_order_rules_status",(req, res,next)=>{
		CronModule.updateOrderRulesStatus(req, res,next);
	});

	/** Routing is used to update offer status **/
	app.get(modulePath+"/update_offer_status",(req, res,next)=>{
		CronModule.updateOfferStatus(req, res,next);
	});

	/** Routing is used to update order delivery preparation time **/
	app.get(modulePath+"/update_order_delivery_preparation_time",(req, res,next)=>{
		CronModule.updateOrderDeliveryPreparationTime(req, res,next);
	});

	/** Routing is used to update order scheduled **/
	app.get(modulePath+"/order_scheduled",(req, res,next)=>{
		CronModule.orderScheduled(req, res,next);
	});

	/** Routing is used to update driver free time or  order prepare remaining time **/
	app.get(modulePath+"/update_captain_free_order_prepare_time",(req, res,next)=>{
		CronModule.updateCaptainFreeTime(req, res,next);
	});

	/** Routing is used to update order canceled **/
	app.get(modulePath+"/order_canceled",(req, res,next)=>{
		CronModule.orderCanceled(req, res,next);
	});

	/** Routing is used to update driver available status **/
	app.get(modulePath+"/update_driver_available_status",(req, res,next)=>{
		CronModule.updateDriverAvailableStatus(req, res,next);
	});

	/** Routing is used to update wallat user log**/
	app.get(modulePath+"/update_wallet_logs",(req, res,next)=>{
		CronModule.updateWalletLogs(req, res,next);
	});

	/** Routing is used to assign captain **/
	app.get(modulePath+"/assign_captain",(req, res,next)=>{
		CronModule.assignCaptain(req, res,next);
	});

	/** Routing is used to update order assignment logs **/
	app.get(modulePath+"/cancel_driver_assignment_request",(req, res,next)=>{
		CronModule.updateOrderAssignmentLogs(req, res,next);
	});

	/** Routing is used to send order remind notification to users **/
	app.get(modulePath+"/send_order_remind_notification",(req, res,next)=>{
		CronModule.sendOrderRemindNotification(req, res,next);
	});

	/** Routing is used to get report of customer order **/
	app.get([
		modulePath+"/report_customer_order_value",
		modulePath+"/report_customer_order_value/:days",
	],(req, res,next)=>{
		CronModule.getReportCustomerOrderValue(req, res,next);
	});

	/** Routing is used to get refund customer payment **/
	app.get(modulePath+"/refund_customer_payment",(req, res,next)=>{
		CronModule.paymentRefund(req, res,next);
	});

	/** Routing is used to mark menu active **/
	app.get(modulePath+"/mark_menu_active",(req, res,next)=>{
		CronModule.markMenuActive(req, res,next);
	});

	/** Routing is used to mark menu active **/
	app.get(modulePath+"/remove_modified_order_from_cart",(req, res,next)=>{
		CronModule.removeModifiedOrderFromCart(req, res,next);
	});

	/** Routing is used to update cravez item **/
	app.get([
		modulePath+"/update_cravez_item",
		modulePath+"/update_cravez_item/:item_id",
		modulePath+"/update_cravez_item/:item_id/:vgroup_id",
	],(req, res,next)=>{
		CronModule.updateCravezItems(req, res,next);
	});

	/** Routing is used to update cravez combo item **/
	app.get([
		modulePath+"/update_cravez_combo_item",
		modulePath+"/update_cravez_combo_item/:item_id"
	],(req, res,next)=>{
		CronModule.updateCravezComboItems(req, res,next);
	});

	/** Routing is used to update agent performance **/
	app.get(modulePath+"/agent_performance_migrate",(req, res,next)=>{
		CronModule.agentPerformance(req, res,next);
	});

	/** Routing is used to get daily agent performance **/
	app.get(modulePath+"/daily_performance",(req, res,next)=>{
		CronModule.calculateDailyStats(req, res,next);
	});

	/** Routing is used to get monthly agent performance **/
	app.get(modulePath+"/weekly_quality",(req, res,next)=>{
		CronModule.weeklyQualityStats(req, res,next);
	});

	/** Routing is used to save order cuisine report **/
	app.get([
		modulePath+"/save_order_cuisine_report",
		modulePath+"/save_order_cuisine_report/:days"
	],(req, res,next)=>{
		CronModule.saveOrderCuisineReport(req, res,next);
	});

	/** Routing is used to abandon cart notification **/
	app.get(modulePath+"/abandon_cart_notification",(req, res,next)=>{
		CronModule.abandonCartNotification(req, res,next);
	});

	/** Routing is used to save driver petrol consumption**/
	app.get([
		modulePath+"/save_driver_petrol_consumption",
		modulePath+"/save_driver_petrol_consumption/:days"
	],(req, res,next)=>{
		CronModule.saveDriverPetrolConsumption(req,res,next);
	});

	/** Routing is used to save_driver_wise_orders**/
	app.get([
		modulePath+"/save_captain_wise_processed_orders",
		modulePath+"/save_captain_wise_processed_orders/:days"
	],(req, res,next)=>{
		CronModule.saveCaptainWiseOrders(req,res,next);
	});
	/** Routing is used to save_branch_wise_orders**/
	app.get([
		modulePath+"/save_branch_wise_processed_orders",
		modulePath+"/save_branch_wise_processed_orders/:days"
	],(req, res,next)=>{
		CronModule.saveRestaurnatWiseOrders(req,res,next);
	});

	/** Routing is used to save_operation_report**/
	app.get([
		modulePath+"/save_operation_report",
		modulePath+"/save_operation_report/:days"
	],(req, res,next)=>{
		CronModule.saveOperationReport(req,res,next);
	});
	/** Routing is used to save_operation_report**/
	app.get([
		modulePath+"/save_customer_breakdown_report",
		modulePath+"/save_customer_breakdown_report/:days"
	],(req, res,next)=>{
		CronModule.saveCustomerBreakdownReport(req,res,next);
	});

	/** Routing is used to save average basket suze report**/
	app.get([
		modulePath+"/save_avg_basket_size_report",
		modulePath+"/save_avg_basket_size_report/:days"
	],(req, res,next)=>{
		CronModule.saveAverageBasketSizeReport(req,res,next);
	});

	/** Routing is used to save_customer order stats report**/
	app.get([
		modulePath+"/save_customer_order_stats_report",
		modulePath+"/save_customer_order_stats_report/:days"
	],(req, res,next)=>{
		CronModule.saveCustomerOrderStatsReport(req,res,next);
	});

	/** Routing is used to send_order_delayed_voc**/
	app.get(modulePath+"/send_order_delayed_voc",(req, res,next)=>{
		CronModule.sendAutomaticOrdersVocPN(req,res,next);
	});

	/** Routing is used to send_shift_join_pn**/
	app.get(modulePath+"/send_shift_join_pn",(req, res,next)=>{
		CronModule.sendShiftJoinPN(req,res,next);
	});

	/** Routing is used to write settings file**/
	app.get(modulePath+"/write_settings_file",(req, res,next)=>{
		CronModule.writeSettingsFile(req,res,next);
	});

	/** Routing is used to auto end break **/
	app.get(modulePath+"/auto_end_break",(req, res,next)=>{
		CronModule.autoEndBreak(req,res,next);
	});

	/** Routing is used to send pn **/
	app.get(modulePath+"/send_scheduled_push_notifications",(req, res,next)=>{
		CronModule.sendScheduledPNs(req, res,next);
	});

	/** Routing is used to get bulk avaya data **/
	app.get([
		modulePath+"/avaya_data_bulk_upload",
		modulePath+"/avaya_data_bulk_upload/:days"
	],(req, res,next)=>{
		CronModule.getBulkAvayaData(req, res,next);
	});

	/** Routing is used to get avaya data **/
	app.get(modulePath+"/get_avaya_data/:date",(req, res,next)=>{
		CronModule.getAvayaData(req, res,next);
	});

	/************************************************ Testing routes ********************************************************************* */

	/** Routing is used to update branch details **/
	app.get([
		modulePath+"/test_assignment",
		modulePath+"/test_assignment/:api_key",
	],(req, res,next)=>{
		let apiKey  = req?.params?.api_key || Constants.DISTANCE_GOOGLE_API;
		try{
			distance.apiKey 	= 	apiKey;
			let origins 		= 	['29.351233028160806,47.98212759196758' ];
			let destinations 	=	['30.0470995,30.0470995' ];
			let request			=	{
				origins		: origins,
				destinations: destinations,
				mode		: "driving"
			};

			distance.get(request,(err, data)=>{
				res.send({
					apiKey	 	:	apiKey,
					err 		: 	String(err),
					request 	: 	request,
					response	: 	data,
				});
			});
		}catch(err){
			res.send({
				apiKey:	apiKey,
				err: String(err),
				catch: true,
			});
		}
	});

	/** Routing is used to save branch open status **/
	app.get(modulePath+"/order_assignment_details/:order_id",(req, res,next)=>{

		const orders = db.collection(Tables.ORDERS);
		orders.findOne({ unique_order_id: req.params.order_id },{projection:{_id:1}}).then(orderDetails=>{

			if(!orderDetails) return res.send({message: "no order details found "});

			const order_assignment_log_steps = db.collection(Tables.ORDER_ASSIGNMENT_LOG_STEPS);
			order_assignment_log_steps.find({order_id : orderDetails._id, },{projection: {_id:0 }}).sort({_id : Constants.SORT_DESC}).toArray().then(result=>{

				res.send({result});
			}).catch(next);
		}).catch(next);
	});
}