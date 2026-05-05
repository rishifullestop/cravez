import { fileURLToPath } from 'url';
import { dirname } from 'path';

import customerOrderModel from "./model/customer_order.mjs";
import paymentModel from "./model/payment_report.mjs";
import customerModel from "./model/customer_report.mjs";
import customerServerModel from "./model/customer_report_server.mjs";
import restaurantOrdersCountModel from "./model/restaurant_orders_count_report.mjs";
import unsettledPaymentsModel from "./model/unsettled_payments.mjs";
import settledPaymentsModel from "./model/settled_payments.mjs";
import orderCountModel from "./model/order_count_report.mjs";
import manualWalletRefundModel from "./model/manual_wallet_refund_report.mjs";
import orderValueModel from "./model/order_value_report.mjs";
import topSellingItemsModel from "./model/top_selling_items.mjs";
import mostSellingItemsModel from "./model/most_selling_items.mjs";
import avgUnitSoldMoMModel from "./model/average_unit_sold_report.mjs";
import avgBasketSizeChangeModel from "./model/average_basket_size_change_report.mjs";
import numberOfCustomersModel from "./model/number_of_customers_first_order.mjs";
import favouriteRestaurantModel from "./model/favourite_restaurant_report.mjs";
import favouriteCuisineModel from "./model/favourite_cuisine_report.mjs";
import orderPaymentCancelModel	from "./model/order_payment_cancel.mjs";
import operationReportModel from "./model/operation_report.mjs";
import ordersPerGovernorateModel from "./model/orders_per_governorate.mjs";
import offerOnlyCustomersModel from "./model/offer_only_customer_report.mjs";
import cusineSalesReportModel from "./model/cuisine_sales_share_report.mjs";
import customerSegmentationModel from "./model/customer_segmentation_report.mjs";
import customerChurnReportModel from "./model/customer_churn_report.mjs";
import orderFrequencyModel from "./model/order_frequency_report.mjs";
import customReportModel from "./model/custom_reports.mjs";
import topSellingResaurantModel from "./model/top_selling_restaurants.mjs";
import resaurantsRankingModel from "./model/restaurants_ranking_management.mjs";
import resaurantsOrderModel from "./model/restaurants_order_summary.mjs";
import areaSalesShareModel from "./model/area_sales_share_report.mjs";
import cancelledOrdersModel from "./model/cancelled_orders_contribution_report.mjs";
import customerBreakdownModel from "./model/monthly_customer_breakdown_report.mjs";
import avgCustomerOrderValueModel from "./model/average_customer_order_value_report.mjs";
import redeemEveryOfferModel from "./model/redeem_every_offer_report.mjs";
import deliveryTimeAnalysisModel from "./model/delivery_time_analysis_report.mjs";
import driverProductivityModel from "./model/driver_productivity_report.mjs";
import areaAnalysisModel from "./model/area_analysis_report.mjs";
import captainWorkingHoursModel from "./model/captain_working_hours_report.mjs";
import driversCompliantModel from "./model/drivers_compliant_report.mjs";
import abandonedCartModel from "./model/abandoned_cart_report.mjs";
import driversModel from "./model/drivers_report.mjs";
import restaurantPerformanceModel from "./model/restaurant_performance_report.mjs";
import areaPerformanceModel from "./model/area_performance_report.mjs";
import areasContributionModel from "./model/areas_contribution_report.mjs";
import cravezOrdersModel from "./model/cravez_orders_report.mjs";
import restaurantBusyReportModel from "./model/restaurant_busy_report.mjs";
import averageDailyNumberOfOrdersModel from "./model/average_daily_number_of_orders.mjs";
import driverPetrolConsumptionReportModel from "./model/driver_petrol_consumption_report.mjs";
import captainWiseOrdersReportModel from "./model/captain_wise_processed_orders.mjs";
import restaurantOrdersRateModel from "./model/restaurant_order_rate_report.mjs";
import deliveryFeesRevenueModel from "./model/delivery_fees_revenue_report.mjs";
import revenueCommissionReportModel from "./model/revenue_commission_report.mjs";
import allOrderCustomerGuestModel from "./model/all_order_customer_guest_report.mjs";
import salesReportModel from "./model/sales_report.mjs";
import transmissionTimeReportModel from "./model/transmission_time_report.mjs";
import transmissionTimeReportOneModel from "./model/transmission_time_report_one.mjs";
import areaPerformanceHalfYearlyModel from "./model/area_performance_half_yearly_report.mjs";
import restaurantPerformanceHalfYearlyModel from "./model/restaurant_performance_half_yearly_report.mjs";
import areasContributionHalfYearlyModel from "./model/areas_contribution_half_yearly_comparison_report.mjs";
import cravezOrdersHalfYearlyModel from "./model/cravez_orders_half_yearly_comparison_report.mjs";
import restaurantOpenCloseModel from "./model/restaurant_open_close_report.mjs";
import biAnalyticsReportModel from "./model/bi_analytics_report.mjs";
import mostSellingItemWithRelationModel from "./model/most_selling_items_with_relations.mjs";
import salesStaffPortfolioModel from "./model/sales_staff_portfolio_report.mjs";
import orderPaymentMethodModel from "./model/order_payment_methods_report.mjs";
import cravezSalesInvoiceModel from "./model/cravez_sales_invoice_report.mjs";
import ordersModel from "./model/orders_report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure report routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(app, { db, checkLoggedInAdmin }) {
    const reportModulePath = '/report';
	const customerOrderModule = new customerOrderModel(db);
	const paymentModule = new paymentModel(db);
	const customerModule = new customerModel(db);
	const customerServerModule = new customerServerModel(db);
	const restaurantOrdersCountModule = new restaurantOrdersCountModel(db);
	const unsettledPaymentsModule = new unsettledPaymentsModel(db);
	const settledPaymentsModule = new settledPaymentsModel(db);
	const orderCountModule = new orderCountModel(db);
	const manualWalletRefundModule = new manualWalletRefundModel(db);
	const orderValueModule = new orderValueModel(db);
	const topSellingItemsModule = new topSellingItemsModel(db);
	const mostSellingItemsModule = new mostSellingItemsModel(db);
	const avgUnitSoldMoMModule = new avgUnitSoldMoMModel(db);
	const avgBasketSizeChangeModule = new avgBasketSizeChangeModel(db);
	const numberOfCustomersModule = new numberOfCustomersModel(db);
	const favouriteRestaurantModule = new favouriteRestaurantModel(db);
	const favouriteCuisineModule = new favouriteCuisineModel(db);
	const orderPaymentCancelModule = new orderPaymentCancelModel(db);
	const operationReportModule = new operationReportModel(db);
	const ordersPerGovernorateModule = new ordersPerGovernorateModel(db);
	const offerOnlyCustomersModule = new offerOnlyCustomersModel(db);
	const cusineSalesReportModule = new cusineSalesReportModel(db);
	const customerSegmentationModule = new customerSegmentationModel(db);
	const customerChurnReportModule = new customerChurnReportModel(db);
	const orderFrequencyModule = new orderFrequencyModel(db);
	const customReportModule = new customReportModel(db);
	const topSellingResaurantModule = new topSellingResaurantModel(db);
	const resaurantsRankingModule = new resaurantsRankingModel(db);
	const resaurantsOrderModule = new resaurantsOrderModel(db);
	const areaSalesShareModule = new areaSalesShareModel(db);
	const cancelledOrdersModule = new cancelledOrdersModel(db);
	const customerBreakdownModule = new customerBreakdownModel(db);
	const avgCustomerOrderValueModule = new avgCustomerOrderValueModel(db);
	const redeemEveryOfferModule = new redeemEveryOfferModel(db);
	const deliveryTimeAnalysisModule = new deliveryTimeAnalysisModel(db);
	const driverProductivityModule = new driverProductivityModel(db);
	const areaAnalysisModule = new areaAnalysisModel(db);
	const captainWorkingHoursModule = new captainWorkingHoursModel(db);
	const driversCompliantModule = new driversCompliantModel(db);
	const abandonedCartModule = new abandonedCartModel(db);
	const driversModule = new driversModel(db);
	const restaurantPerformanceModule = new restaurantPerformanceModel(db);
	const areaPerformanceModule = new areaPerformanceModel(db);
	const areasContributionModule = new areasContributionModel(db);
	const cravezOrdersModule = new cravezOrdersModel(db);
	const restaurantBusyReportModule = new restaurantBusyReportModel(db);
	const averageDailyNumberOfOrdersModule = new averageDailyNumberOfOrdersModel(db);
	const driverPetrolConsumptionReportModule = new driverPetrolConsumptionReportModel(db);
	const captainWiseOrdersReportModule = new captainWiseOrdersReportModel(db);
	const restaurantOrdersRateModule = new restaurantOrdersRateModel(db);
	const deliveryFeesRevenueModule = new deliveryFeesRevenueModel(db);
	const revenueCommissionReportModule = new revenueCommissionReportModel(db);
	const allOrderCustomerGuestModule = new allOrderCustomerGuestModel(db);
	const salesReportModule = new salesReportModel(db);
	const transmissionTimeReportModule = new transmissionTimeReportModel(db);
	const transmissionTimeReportOneModule = new transmissionTimeReportOneModel(db);
	const areaPerformanceHalfYearlyModule = new areaPerformanceHalfYearlyModel(db);
	const restaurantPerformanceHalfYearlyModule = new restaurantPerformanceHalfYearlyModel(db);
	const areasContributionHalfYearlyModule = new areasContributionHalfYearlyModel(db);
	const cravezOrdersHalfYearlyModule = new cravezOrdersHalfYearlyModel(db);
	const restaurantOpenCloseModule = new restaurantOpenCloseModel(db);
	const biAnalyticsReportModule = new biAnalyticsReportModel(db);
	const mostSellingItemWithRelationModule = new mostSellingItemWithRelationModel(db);
	const salesStaffPortfolioModule = new salesStaffPortfolioModel(db);
	const orderPaymentMethodModule = new orderPaymentMethodModel(db);
	const cravezSalesInvoiceModule = new cravezSalesInvoiceModel(db);
	const ordersModule = new ordersModel(db);

    /** Set current view folder **/
	app.use(reportModulePath,(req, res, next) => {
		req.rendering.views	=	__dirname + "/views";
		next();
	});

	/** Routing is used to get customer order report list **/
	app.all(reportModulePath+"/customer_order",checkLoggedInAdmin,(req, res,next) => {
		customerOrderModule.getCustomerOrderReportList(req, res,next);
	});

	/** Routing is used to get branch  list **/
	app.post(reportModulePath+"/customer_order/branch_list",checkLoggedInAdmin,(req, res,next) => {
		customerOrderModule.branchList(req, res,next);
	});

	/** Routing is used to export customer order report **/
	app.get(reportModulePath+"/customer_order/export_data",checkLoggedInAdmin,(req, res,next) => {
		customerOrderModule.customerOrderExportData(req, res,next);
	});

	/** Routing is used to get payment status report list **/
	app.all(reportModulePath+"/payment_report",checkLoggedInAdmin,(req, res) => {
		paymentModule.getPaymentReportList(req, res);
	});

	/** Routing is used to update  export payment details **/
	app.get(reportModulePath+"/payment_report/export_data",checkLoggedInAdmin,(req, res,next)=>{
		paymentModule.exportData(req,res,next);
	});

	/****/
	/** Routing is used to get payment status report list **/
	app.all(reportModulePath+"/customer_report",checkLoggedInAdmin,(req, res) => {
		customerModule.getCustomerReportList(req, res);
	});

	/** Routing is used to get payment status report list **/
	app.all(reportModulePath + "/customer_report/export_data", checkLoggedInAdmin, (req, res) => {
		customerModule.exportCustomerReport(req, res);
	});

	/** Routing is used to get customer_report_server list **/
	app.all(reportModulePath+"/customer_report_server",checkLoggedInAdmin,(req, res) => {
		customerServerModule.getCustomerReportServerList(req, res);
	});

	/** Routing is used to export customer_report_server list **/
	app.all(reportModulePath + "/customer_report_server/export_data", checkLoggedInAdmin, (req, res) => {
		customerServerModule.exportCustomerReportServer(req, res);
	});

	/** Routing is used to get restaurant orders count report list **/
	app.get(reportModulePath+"/restaurant_orders_report",checkLoggedInAdmin,(req, res, next) => {
		restaurantOrdersCountModule.getRestaurantOrdersCountList(req, res, next);
	});

	/** Routing is used to get restaurant orders count report list **/
	app.all([
		reportModulePath+"/append_restaurant_orders_report/:from_date/:to_date/:restaurant_id",
		reportModulePath+"/append_restaurant_orders_report/:from_date/:to_date/:restaurant_id/:branch_id",
	],checkLoggedInAdmin,(req, res, next) => {
		restaurantOrdersCountModule.appendRestaurantOrdersCountList(req, res, next);
	});

	/** Routing is used to export restaurant orders count report **/
	app.get([
		reportModulePath+"/restaurant_orders_report/export_data/:from_date/:to_date",
		reportModulePath+"/restaurant_orders_report/export_data/:from_date/:to_date/:restaurant_id",
		reportModulePath+"/restaurant_orders_report/export_data/:from_date/:to_date/:restaurant_id/:branch_id",
	],checkLoggedInAdmin,(req, res, next) => {
		restaurantOrdersCountModule.restaurantOrderExportData(req, res, next);
	});

	/** Routing is used to get unsettled payments list **/
	app.all(reportModulePath+"/unsettled_payment",checkLoggedInAdmin,(req, res,next) => {
		unsettledPaymentsModule.getUnsettledPaymentsList(req, res,next);
	});

	/** Routing is used to pay unsettled payment **/
	app.all(reportModulePath+"/unsettled_payment/pay/:restaurant_id",checkLoggedInAdmin,(req, res,next) => {
		unsettledPaymentsModule.proceedUnsettledPayments(req, res,next);
	});

	/** Routing is used to get order logs list **/
	app.all(reportModulePath+"/settled_payment/order_details/:restaurant_id",checkLoggedInAdmin,(req, res,next) => {
		unsettledPaymentsModule.getOrderDetailsList(req, res,next,true);
	});

	/** Routing is used to get order logs list **/
	app.all(reportModulePath+"/unsettled_payment/order_details/:restaurant_id",checkLoggedInAdmin,(req, res,next) => {
		unsettledPaymentsModule.getOrderDetailsList(req, res,next);
	});

	/** Routing is used to get payment history list **/
	app.all(reportModulePath+"/unsettled_payment/payment_history/:restaurant_id",checkLoggedInAdmin,(req, res,next) => {
		unsettledPaymentsModule.getPaymentHistoryList(req, res,next);
	});

	/** Routing is used to get settled payments list **/
	app.all(reportModulePath+"/settled_payments",checkLoggedInAdmin,(req, res,next) => {
		settledPaymentsModule.getSettledPaymentsList(req, res,next);
	});

	/** Routing is used to get manual wallet refund report **/
	app.get(reportModulePath+"/manual_wallet_refund_report",checkLoggedInAdmin,(req, res,next) => {
		manualWalletRefundModule.getManualWalletRefundList(req, res,next);
	});

	/** Routing is used to append manual wallet refund report **/
	app.all([
		reportModulePath+"/append_manual_wallet_refund_report/:from_date/:to_date/:restaurant_id",
		reportModulePath+"/append_manual_wallet_refund_report/:from_date/:to_date/:restaurant_id/:branch_id",
	],checkLoggedInAdmin,(req, res,next) => {
		manualWalletRefundModule.appendManualWalletRefundList(req, res,next);
	});

	/** Routing is used to export manual wallet refund report **/
	app.get([
		reportModulePath+"/manual_wallet_refund_report/export_data/:from_date/:to_date",
		reportModulePath+"/manual_wallet_refund_report/export_data/:from_date/:to_date/:restaurant_id",
		reportModulePath+"/manual_wallet_refund_report/export_data/:from_date/:to_date/:restaurant_id/:branch_id",
	],checkLoggedInAdmin,(req, res, next) => {
		manualWalletRefundModule.manualWalletRefundExportData(req, res, next);
	});

	/** Routing is used to get order count report **/
	app.all(reportModulePath+"/order_count_report",checkLoggedInAdmin,(req, res,next) => {
		orderCountModule.getOrderCountList(req, res,next);
	});

	/** Routing is used to export order count report **/
	app.get(reportModulePath+"/order_count_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		orderCountModule.orderCountExportData(req, res, next);
	});

	/** Routing is used to get order value report **/
	app.all(reportModulePath+"/order_value_report",checkLoggedInAdmin,(req, res,next) => {
		orderValueModule.getOrderValueList(req, res,next);
	});

	/** Routing is used to append order value report **/
	app.get(reportModulePath+"/order_value_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		orderValueModule.orderValueExportData(req, res, next);
	});

	/** Routing is used to get average daily number of orders report **/
	app.all(reportModulePath+"/average_daily_number_of_orders",checkLoggedInAdmin,(req, res,next) => {
		averageDailyNumberOfOrdersModule.getAverageDailyNumberOfOrdersList(req, res,next);
	});

	/** Routing is used to export average daily number of orders report **/
	app.get(reportModulePath+"/average_daily_number_of_orders/export_data",checkLoggedInAdmin,(req, res, next) => {
		averageDailyNumberOfOrdersModule.averageDailyNumberOfOrdersExportData(req, res, next);
	});

	/** Routing is used to get average daily number of orders report **/
	app.all(reportModulePath+"/orders_per_governorate",checkLoggedInAdmin,(req, res,next) => {
		ordersPerGovernorateModule.getOrdersPerGovernorate(req, res,next);
	});

	/** Routing is used to export average daily number of orders report **/
	app.get(reportModulePath+"/orders_per_governorate/export_data",checkLoggedInAdmin,(req, res, next) => {
		ordersPerGovernorateModule.exportGetOrdersPerGovernorate(req, res, next);
	});

	/** Routing is used to get top selling items report **/
	app.all(reportModulePath+"/top_selling_items",checkLoggedInAdmin,(req, res,next) => {
		topSellingItemsModule.getTopSellingItemsList(req, res,next);
	});

	/** Routing is used to export top selling items report **/
	app.get(reportModulePath+"/top_selling_items/export_data",checkLoggedInAdmin,(req, res, next) => {
		topSellingItemsModule.topSellingItemsExportData(req, res, next);
	});

	/** Routing is used to get most selling items report **/
	app.all(reportModulePath+"/most_selling_items",checkLoggedInAdmin,(req, res,next) => {
		mostSellingItemsModule.getMostSellingItemsList(req, res,next);
	});

	/** Routing is used to export most selling items report **/
	app.get(reportModulePath+"/most_selling_items/export_data",checkLoggedInAdmin,(req, res, next) => {
		mostSellingItemsModule.mostSellingItemsExportData(req, res, next);
	});

	/** Routing is used to get offer only customer report **/
	app.all(reportModulePath+"/offer_only_customer_report",checkLoggedInAdmin,(req, res,next) => {
		offerOnlyCustomersModule.getOfferOnlyCustomers(req, res,next);
	});

	/** Routing is used to export offer only customer report**/
	app.get(reportModulePath+"/offer_only_customer_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		offerOnlyCustomersModule.offerOnlyCustomersExport(req, res, next);
	});

	/** Routing is used to get cuisine sales share report report **/
	app.all(reportModulePath+"/cuisine_sales_share_report",checkLoggedInAdmin,(req, res,next) => {
		cusineSalesReportModule.getCuisineSalesReport(req, res,next);
	});

	/** Routing is used to export cuisine sales share report report**/
	app.get(reportModulePath +"/cuisine_sales_share_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		cusineSalesReportModule.cuisineSalesShareExport(req, res, next);
	});

	/** Routing is used to get cuisine segmentation report report **/
	app.all(reportModulePath+"/customer_segmentation_report",checkLoggedInAdmin,(req, res,next) => {
		customerSegmentationModule.getCustomerSegmentationReport(req, res,next);
	});

	/** Routing is used to export cuisine segmentation report report**/
	app.get(reportModulePath +"/customer_segmentation_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		customerSegmentationModule.customerSegmentationExport(req, res, next);
	});

	/** Routing is used to get customer_churn_report report **/
	app.all(reportModulePath+"/customer_churn_report",checkLoggedInAdmin,(req, res,next) => {
		customerChurnReportModule.getCustomerChurnReport(req, res,next);
	});

	/** Routing is used to export customer_churn_report**/
	app.get(reportModulePath+"/customer_churn_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		customerChurnReportModule.churnReportExport(req, res, next);
	});

	/** Routing is used to get custom_reports report **/
	app.all(reportModulePath+"/custom_reports",checkLoggedInAdmin,(req, res,next) => {
		customReportModule.getCustomReports(req, res,next);
	});

	/** Routing is used to export custom_reports**/
	app.get(reportModulePath +"/custom_reports/export_data",checkLoggedInAdmin,(req, res, next) => {
		customReportModule.customReportsExport(req, res, next);
	});

	/** Routing is used to get average_unit_sold_mom report **/
	app.all(reportModulePath+"/average_unit_sold_report",checkLoggedInAdmin,(req, res,next) => {
		avgUnitSoldMoMModule.avgUnitSoldMoM(req, res,next);
	});

	/** Routing is used to export average_unit_sold_mom report **/
	app.get(reportModulePath+"/average_unit_sold_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		avgUnitSoldMoMModule.avgUnitSoldMoMExport(req, res, next);
	});


	/** Routing is used to get average_unit_sold_mom report **/
	app.all(reportModulePath + "/average_basket_size_change_report", checkLoggedInAdmin, (req, res, next) => {
		avgBasketSizeChangeModule.avgBasketSizeChangeReport(req, res, next);
	});

	/** Routing is used to export average_unit_sold_mom report **/
	app.get(reportModulePath + "/average_basket_size_change_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		avgBasketSizeChangeModule.avgBasketSizeChangeExport(req, res, next);
	});

	/** Routing is used to get number of customers who made first order from cravez list **/
	app.all(reportModulePath+"/number_of_customers",checkLoggedInAdmin,(req, res,next) => {
		numberOfCustomersModule.getNumberOfCustomersList(req, res,next);
	});

	/** Routing is used to export number of customers who made first order from cravez list **/
	app.get(reportModulePath+"/number_of_customers/export_data",checkLoggedInAdmin,(req, res,next) => {
		numberOfCustomersModule.numberOfCustomersExportData(req, res,next);
	});

	/** Routing is used to get favourite restaurant list **/
	app.all(reportModulePath+"/favourite_restaurant_report",checkLoggedInAdmin,(req, res,next) => {
		favouriteRestaurantModule.getFavouriteRestaurantList(req, res,next);
	});

	/** Routing is used to export favourite restaurant list **/
	app.get(reportModulePath+"/favourite_restaurant_report/export_data",checkLoggedInAdmin,(req, res,next) => {
		favouriteRestaurantModule.favouriteRestaurantExport(req, res,next);
	});

	/** Routing is used to get favourite cuisine list **/
	app.all(reportModulePath+"/favourite_cuisine_report",checkLoggedInAdmin,(req, res,next) => {
		favouriteCuisineModule.getFavouriteCuisineList(req, res,next);
	});

	/** Routing is used to export favourite cuisine list **/
	app.get(reportModulePath+"/favourite_cuisine_report/export_data",checkLoggedInAdmin,(req, res,next) => {
		favouriteCuisineModule.favouriteCuisineExport(req, res,next);
	});

	/** Routing is used to get order payment cancel list **/
	app.all(reportModulePath+"/order_payment_cancel",checkLoggedInAdmin,(req, res,next) => {
		orderPaymentCancelModule.getOrderPaymentCancelList(req, res,next);
	});

	/** Routing is used to export order payment cancel list **/
	app.all(reportModulePath + "/order_payment_cancel/export_data", checkLoggedInAdmin, (req, res, next) => {
		orderPaymentCancelModule.exportOrderPaymentCancel(req, res, next);
	});


	/** Routing is used to get branch list **/
	app.post(reportModulePath+"/branch_list",checkLoggedInAdmin,(req, res,next) => {
		unsettledPaymentsModule.unsettledBranchList(req, res,next);
	});

	/** Routing is used to update  export order details **/
	app.all(reportModulePath+"/export_data",checkLoggedInAdmin,(req, res,next)=>{
		unsettledPaymentsModule.orderExportData(req,res,next);
	});

	/** Routing is used to update  export order details **/
	app.all(reportModulePath+"/settled_export_data/export_data",checkLoggedInAdmin,(req, res,next)=>{
		settledPaymentsModule.settledExportData(req,res,next);
	});
	/** Routing is used to update  export order details **/
	app.all(reportModulePath+"/unsettled_export_data/export_data",checkLoggedInAdmin,(req, res,next)=>{
		unsettledPaymentsModule.unsettledExportData(req,res,next);
	});

	/** Routing is used to get driver petrol consumption report list **/
	app.all(reportModulePath+"/driver_petrol_consumption_report",checkLoggedInAdmin,(req, res,next) => {
		driverPetrolConsumptionReportModule.getDriverPetrolConsumptionReportList(req, res,next);
	});


	/** Routing is used to get driver petrol consumption report details **/
	app.all(reportModulePath+"/driver_petrol_consumption_detail/:driver_id/:vehicle_type",checkLoggedInAdmin,(req, res,next) => {
		driverPetrolConsumptionReportModule.driverPetrolConsumptionDetails(req, res,next);
	});

	/** Routing is used to update  export petrol consumption list **/
	app.all(reportModulePath+"/petrol_consumption_list_export/export_data",checkLoggedInAdmin,(req, res,next)=>{
		driverPetrolConsumptionReportModule.petrolConsumListExport(req,res,next);
	});

	/** Routing is used to update  export petrol consumption details **/
	app.all(reportModulePath+"/petrol_consumption_detail_export/export_data",checkLoggedInAdmin,(req, res,next)=>{
		driverPetrolConsumptionReportModule.petrolConsumDetailExport(req,res,next);
	});
	/** Routing is used to get captain_wise_processed_orders list **/
	app.all(reportModulePath+"/captain_wise_order_report",checkLoggedInAdmin,(req, res,next) => {
		captainWiseOrdersReportModule.getCaptainOrdersReportList(req, res,next);
	});

	/** Routing is used to update  export captain_wise_processed_orders **/
	app.all(reportModulePath +"/captain_wise_order_report/export_data",checkLoggedInAdmin,(req, res,next)=>{
		captainWiseOrdersReportModule.captianOrderExport(req,res,next);
	});

	/** Routing is used to get restaurant_order_rate_report list **/
	app.all(reportModulePath+"/restaurant_order_rate_report",checkLoggedInAdmin,(req, res,next) => {
		restaurantOrdersRateModule.getBranchOrdersReportList(req, res,next);
	});

	/** Routing is used to update export restaurant_order_rate_report **/
	app.all(reportModulePath+"/restaurant_order_rate_report/export_data",checkLoggedInAdmin,(req, res,next)=>{
		restaurantOrdersRateModule.restaurantOrderRateExport(req,res,next);
	});

	/** Routing is used to get delivery fees revenue list **/
	app.all(reportModulePath+"/delivery_fees_revenue_report",checkLoggedInAdmin,(req, res,next) => {
		deliveryFeesRevenueModule.getDeliveryFeesReportList(req, res,next);
	});

	/** Routing is used to update export restaurant_order_rate_report **/
	app.all(reportModulePath+"/delivery_fees_revenue_report/export_data",checkLoggedInAdmin,(req, res,next)=>{
		deliveryFeesRevenueModule.getDeliveryFeesRevenueReportExport(req,res,next);
	});

	/** Routing is used to get revenue commission list **/
	app.all(reportModulePath+"/revenue_commission_report",checkLoggedInAdmin,(req, res,next) => {
		revenueCommissionReportModule.getRevenueCommissionList(req, res,next);
	});

	/** Routing is used to update export Revenue Commission **/
	app.all(reportModulePath+"/revenue_commission_report/export_data",checkLoggedInAdmin,(req, res,next)=>{
		revenueCommissionReportModule.getRevenueCommissionReportExport(req,res,next);
	});

	/** Routing is used to get transmission time report list **/
	app.all(reportModulePath+"/transmission_time_report",checkLoggedInAdmin,(req, res,next) => {
		transmissionTimeReportModule.getTransmissionTimeReportList(req, res,next);
	});

	/** Routing is used to get transmission time report export **/
	app.all(reportModulePath+"/transmission_time_report/export_data",checkLoggedInAdmin,(req, res,next) => {
		transmissionTimeReportModule.getTransmissionTimeReportExport(req, res,next);
	});

	/** Routing is used to get transmission time report list **/
	app.all(reportModulePath+"/transmission_time_report_one", checkLoggedInAdmin, (req, res, next) => {
		transmissionTimeReportOneModule.getTransmissionTimeReportOneList(req, res, next);
	});

	/** Routing is used to get transmission time report export **/
	app.all(reportModulePath + "/transmission_time_report_one/export_data", checkLoggedInAdmin, (req, res, next) => {
		transmissionTimeReportOneModule.getTransmissionTimeReportOneExport(req, res, next);
	});

	/** Routing is used to get operation report list **/
	app.all(reportModulePath+"/operation_report",checkLoggedInAdmin,(req, res,next) => {
		operationReportModule.getOperationReportList(req, res,next);
	});

	/** Routing is used to get operation report export **/
	app.all(reportModulePath+"/operation_report/export_data",checkLoggedInAdmin,(req, res,next) => {
		operationReportModule.getOperationReportExport(req, res,next);
	});

	/** Routing is used to get restaurant_order_rate_report list **/
	app.all(reportModulePath+"/all_order_customer_guest_report",checkLoggedInAdmin,(req, res,next) => {
		allOrderCustomerGuestModule.getAllOrdersReportList(req, res,next);
	});

	/** Routing is used to get all_order_customer_guest_report export **/
	app.all(reportModulePath+"/all_order_customer_guest_report/export_data",checkLoggedInAdmin,(req, res,next) => {
		allOrderCustomerGuestModule.getAllOrdersReportExport(req, res,next);
	});

	/** Routing is used to get sales report list **/
	app.all(reportModulePath+"/sales_report",checkLoggedInAdmin,(req, res,next) => {
		salesReportModule.getSalesReportList(req, res,next);
	});

	/** Routing is used to get sales report export **/
	app.all(reportModulePath+"/sales_report/export_data",checkLoggedInAdmin,(req, res,next) => {
		salesReportModule.getSalesReportExport(req, res,next);
	});

	/** Routing is used to get restaurant_branch_dropdown list **/
	app.all(reportModulePath+"/restaurant_branch_dropdown",checkLoggedInAdmin,(req, res,next) => {
		restaurantOrdersRateModule.branchDropdown(req, res,next);
	});

	/** Routing is used to get restaurant_area_dropdown list **/
	app.all(reportModulePath+"/restaurant_area_dropdown",checkLoggedInAdmin,(req, res,next) => {
		restaurantOrdersRateModule.areaDropdown(req, res,next);
	});

	/** Routing is used to get city_area_dropdown list **/
	app.all(reportModulePath+"/city_area_dropdown",checkLoggedInAdmin,(req, res,next) => {
		deliveryFeesRevenueModule.cityAreaDropdown(req, res,next);
	});

	/** Routing is used to get area list list **/
	app.all(reportModulePath+"/get_area_list",checkLoggedInAdmin,(req, res,next) => {
		customerSegmentationModule.getCityAreas(req, res,next);
	});

	/** Routing is used to get top selling restaurants report **/
	app.all(reportModulePath+"/top_selling_restaurants",checkLoggedInAdmin,(req, res,next) => {
		topSellingResaurantModule.getTopsellingRestaurantList(req, res,next);
	});

	/** Routing is used to export top selling restaurants **/
	app.get(reportModulePath+"/top_selling_restaurants/export_data",checkLoggedInAdmin,(req, res, next) => {
		topSellingResaurantModule.exportTopsellingRestaurants(req, res, next);
	});

	/** Routing is used to get restaurants ranking report **/
	app.all(reportModulePath + "/restaurants_ranking_management", checkLoggedInAdmin, (req, res, next) => {
		resaurantsRankingModule.getRestaurantsRankingList(req, res, next);
	});

	/** Routing is used to export restaurants ranking  **/
	app.get(reportModulePath + "/restaurants_ranking_management/export_data", checkLoggedInAdmin, (req, res, next) => {
		resaurantsRankingModule.exportRestaurantsRanking(req, res, next);
	});

	/** Routing is used to get area sales share report **/
	app.all(reportModulePath + "/area_sales_share_report", checkLoggedInAdmin, (req, res, next) => {
		areaSalesShareModule.getAreaSalesShareList(req, res, next);
	});

	/** Routing is used to export area sales share  **/
	app.get(reportModulePath + "/area_sales_share_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		areaSalesShareModule.exportAreaSalesShare(req, res, next);
	});

	/** Routing is used to get restaurants order report **/
	app.all(reportModulePath + "/restaurants_order_summary", checkLoggedInAdmin, (req, res, next) => {
		resaurantsOrderModule.getRestaurantsOrderList(req, res, next);
	});

	/** Routing is used to export restaurants order **/
	app.get(reportModulePath + "/restaurants_order_summary/export_data", checkLoggedInAdmin, (req, res, next) => {
		resaurantsOrderModule.exportRestaurantsOrder(req, res, next);
	});

	/** Routing is used to get restaurants order report **/
	app.all(reportModulePath + "/restaurants_order_summary/previous_data", checkLoggedInAdmin, (req, res, next) => {
		resaurantsOrderModule.getPreviousDateData(req, res, next);
	});

	/** Routing is used to get order_frequency_report report **/
	app.all(reportModulePath+"/order_frequency_report",checkLoggedInAdmin,(req, res,next) => {
		orderFrequencyModule.getOrderFrequencyReport(req, res,next);
	});

	/** Routing is used to export order_frequency_report**/
	app.get(reportModulePath+"/order_frequency_report/export_data",checkLoggedInAdmin,(req, res, next) => {
		orderFrequencyModule.orderFrequencyExport(req, res, next);
	});

	/** Routing is used to get cancelled orders contribution report **/
	app.all(reportModulePath + "/cancelled_orders_contribution_report", checkLoggedInAdmin, (req, res, next) => {
		cancelledOrdersModule.getCancelledOrdersContributionList(req, res, next);
	});

	/** Routing is used to export cancelled orders contribution report**/
	app.get(reportModulePath + "/cancelled_orders_contribution_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		cancelledOrdersModule.cancelledOrdersContributionExportData(req, res, next);
	});

	/** Routing is used to get monthly customer breakdown report **/
	app.all(reportModulePath + "/monthly_customer_breakdown_report", checkLoggedInAdmin, (req, res, next) => {
		customerBreakdownModule.getCustomerBreakdownReport(req, res, next);
	});

	/** Routing is used to export monthly customer breakdown report**/
	app.get(reportModulePath + "/monthly_customer_breakdown_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		customerBreakdownModule.exportCustomerBreakdownReport(req, res, next);
	});

	/** Routing is used to get average customer order value report **/
	app.all(reportModulePath + "/average_customer_order_value_report", checkLoggedInAdmin, (req, res, next) => {
		avgCustomerOrderValueModule.getAvgCustomerOrderValueList(req, res, next);
	});

	/** Routing is used to export average customer order value report**/
	app.get(reportModulePath + "/average_customer_order_value_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		avgCustomerOrderValueModule.avgCustomerOrderValueReportExport(req, res, next);
	});

	/** Routing is used to get aredeem_every_offer_report **/
	app.all(reportModulePath + "/redeem_every_offer_report", checkLoggedInAdmin, (req, res, next) => {
		redeemEveryOfferModule.getRedeemEveryOfferReport(req, res, next);
	});

	/** Routing is used to export redeem_every_offer_report**/
	app.get(reportModulePath + "/redeem_every_offer_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		redeemEveryOfferModule.redeemEveryOfferReportExport(req, res, next);
	});

	/** Routing is used to get delivery_time_analysis_report **/
	app.all(reportModulePath + "/delivery_time_analysis_report", checkLoggedInAdmin, (req, res, next) => {
		deliveryTimeAnalysisModule.getDeliveryTimeAnalysisReportList(req, res, next);
	});

	/** Routing is used to export delivery_time_analysis_report**/
	app.get(reportModulePath + "/delivery_time_analysis_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		deliveryTimeAnalysisModule.getDeliveryTimeAnalysisReportExport(req, res, next);
	});

	/** Routing is used to get driver_productivity_report **/
	app.all(reportModulePath + "/driver_productivity_report", checkLoggedInAdmin, (req, res, next) => {
		driverProductivityModule.getDriverProductivityReportList(req, res, next);
	});

	/** Routing is used to export driver_productivity_report**/
	app.get(reportModulePath + "/driver_productivity_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		driverProductivityModule.getDriverProductivityReportExport(req, res, next);
	});

	/** Routing is used to get area_analysis_report **/
	app.all(reportModulePath + "/area_analysis_report", checkLoggedInAdmin, (req, res, next) => {
		areaAnalysisModule.getAreaAnalysisReportList(req, res, next);
	});

	// /** Routing is used to get area_analysis_report **/
	// app.get(reportModulePath + "/get_restaurants", checkLoggedInAdmin, (req, res, next) => {
	// 	getRestaurantsList(req, res, next);
	// });

	/** Routing is used to export area_analysis_report**/
	app.get(reportModulePath + "/area_analysis_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		areaAnalysisModule.areaAnalysisReportExport(req, res, next);
	});

	/** Routing is used to get captain_working_hours_report **/
	app.all(reportModulePath + "/captain_working_hours_report", checkLoggedInAdmin, (req, res, next) => {
		captainWorkingHoursModule.getCaptainWorkingHoursReportList(req, res, next);
	});

	/** Routing is used to export captain_working_hours_report**/
	app.get(reportModulePath + "/captain_working_hours_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		captainWorkingHoursModule.captainWorkingHoursReportExport(req, res, next);
	});

	/** Routing is used to get drivers_compliant_report **/
	app.all(reportModulePath + "/drivers_compliant_report", checkLoggedInAdmin, (req, res, next) => {
		driversCompliantModule.getDriversCompliantReportList(req, res, next);
	});

	/** Routing is used to export drivers_compliant_report**/
	app.get(reportModulePath + "/drivers_compliant_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		driversCompliantModule.driversCompliantReportExport(req, res, next);
	});

	/** Routing is used to get abandoned_cart_report **/
	app.all(reportModulePath + "/abandoned_cart_report", checkLoggedInAdmin, (req, res, next) => {
		abandonedCartModule.getAbandonedCartReportList(req, res, next);
	});

	/** Routing is used to export abandoned_cart_report**/
	app.get(reportModulePath + "/abandoned_cart_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		abandonedCartModule.abandonedCartReportExport(req, res, next);
	});

	/** Routing is used to get drivers_report **/
	app.all(reportModulePath + "/drivers_report", checkLoggedInAdmin, (req, res, next) => {
		driversModule.getDriversReportList(req, res, next);
	});

	/** Routing is used to export drivers_report**/
	app.get(reportModulePath + "/drivers_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		driversModule.driversReportExport(req, res, next);
	});

	/** Routing is used to get restaurant_performance_report **/
	app.all(reportModulePath + "/restaurant_performance_report", checkLoggedInAdmin, (req, res, next) => {
		restaurantPerformanceModule.getRestaurantPerformanceList(req, res, next);
	});

	/** Routing is used to export restaurant_performance_report**/
	app.get(reportModulePath + "/restaurant_performance_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		restaurantPerformanceModule.restaurantPerformanceReportExport(req, res, next);
	});

	/** Routing is used to get area_performance_report **/
	app.all(reportModulePath + "/area_performance_report", checkLoggedInAdmin, (req, res, next) => {
		areaPerformanceModule.getAreaPerformanceList(req, res, next);
	});

	/** Routing is used to export area_performance_report**/
	app.get(reportModulePath + "/area_performance_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		areaPerformanceModule.areaPerformanceReportExport(req, res, next);
	});

	/** Routing is used to get areas_contribution_report **/
	app.all(reportModulePath + "/areas_contribution_report", checkLoggedInAdmin, (req, res, next) => {
		areasContributionModule.getAreasContributionList(req, res, next);
	});

	/** Routing is used to export areas_contribution_report**/
	app.get(reportModulePath + "/areas_contribution_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		areasContributionModule.areasContributionReportExport(req, res, next);
	});

	/** Routing is used to get cravez_orders_report **/
	app.all(reportModulePath + "/cravez_orders_report", checkLoggedInAdmin, (req, res, next) => {
		cravezOrdersModule.getCravezOrdersList(req, res, next);
	});

	/** Routing is used to export cravez_orders_report**/
	app.get(reportModulePath + "/cravez_orders_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		cravezOrdersModule.cravezOrdersReportExport(req, res, next);
	});

	/** Routing is used to get areas_contribution half yearly report **/
	app.all(reportModulePath + "/areas_contribution_half_yearly_report", checkLoggedInAdmin, (req, res, next) => {
		areasContributionHalfYearlyModule.getAreasContributionHalfYearlyList(req, res, next);
	});

	/** Routing is used to export areas_contribution half yearly report**/
	app.get(reportModulePath + "/areas_contribution_half_yearly_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		areasContributionHalfYearlyModule.areasContributionHalfYearlyReportExport(req, res, next);
	});

	/** Routing is used to get area_performance_half_yearly_report **/
	app.all(reportModulePath + "/area_performance_half_yearly_report", checkLoggedInAdmin, (req, res, next) => {
		areaPerformanceHalfYearlyModule.getAreaPerformanceHalfYearlyList(req, res, next);
	});

	/** Routing is used to export area_performance_half_yearly_report**/
	app.get(reportModulePath + "/area_performance_half_yearly_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		areaPerformanceHalfYearlyModule.areaPerformanceHalfYearlyReportExport(req, res, next);
	});

	/** Routing is used to get cravez_orders half yearly report **/
	app.all(reportModulePath + "/cravez_orders_half_yearly_report", checkLoggedInAdmin, (req, res, next) => {
		cravezOrdersHalfYearlyModule.getCravezOrdersHalfYearlyList(req, res, next);
	});

	/** Routing is used to export cravez_orders half yearly report**/
	app.get(reportModulePath + "/cravez_orders_half_yearly_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		cravezOrdersHalfYearlyModule.cravezOrdersHalfYearlyReportExport(req, res, next);
	});

	/** Routing is used to get restaurant_busy_report **/
	app.all(reportModulePath + "/restaurant_busy_report", checkLoggedInAdmin, (req, res, next) => {
		restaurantBusyReportModule.getBusyReportList(req, res, next);
	});

	/** Routing is used to export restaurant_busy_report**/
	app.get(reportModulePath + "/restaurant_busy_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		restaurantBusyReportModule.exportBusyReport(req, res, next);
	});

	/** Routing is used to get restaurant_performance_half_yearly_report **/
	app.all(reportModulePath + "/restaurant_performance_half_yearly_report", checkLoggedInAdmin, (req, res, next) => {
		restaurantPerformanceHalfYearlyModule.getRestaurantPerformanceHalfYearlyList(req, res, next);
	});

	/** Routing is used to export restaurant_performance_half_yearly_report**/
	app.get(reportModulePath + "/restaurant_performance_half_yearly_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		restaurantPerformanceHalfYearlyModule.restaurantPerformanceHalfYearlyReportExport(req, res, next);
	});

	/** Routing is used to get restaurant_open_close_report **/
	app.all(reportModulePath + "/restaurant_open_close_report", checkLoggedInAdmin, (req, res, next) => {
		restaurantOpenCloseModule.getRestaurantOpenCloseReportList(req, res, next);
	});

	/** Routing is used to export restaurant_open_close_report**/
	app.get(reportModulePath + "/restaurant_open_close_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		restaurantOpenCloseModule.restaurantOpenCloseReportExport(req, res, next);
	});

	/** Routing is used to get bi_analytics_report **/
	app.all(reportModulePath + "/bi_analytics_report", checkLoggedInAdmin, (req, res, next) => {
		biAnalyticsReportModule.getAnalyticsReportList(req, res, next);
	});

	/** Routing is used to export bi_analytics_report**/
	app.get(reportModulePath + "/bi_analytics_report/get_item_list", checkLoggedInAdmin, (req, res, next) => {
		biAnalyticsReportModule.getItemList(req, res, next);
	});

	/** Routing is used to get sales_staff_portfolio_report **/
	app.all(reportModulePath + "/sales_staff_portfolio_report", checkLoggedInAdmin, (req, res, next) => {
		salesStaffPortfolioModule.getSalesStaffPortfolioList(req, res, next);
	});

	/** Routing is used to export sales_staff_portfolio_report**/
	app.get(reportModulePath + "/sales_staff_portfolio_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		salesStaffPortfolioModule.salesStaffPortfolioReportExport(req, res, next);
	});

	/** Routing is used to get most_selling_items_with_relation **/
	app.all(reportModulePath + "/rest_most_selling_item_with_relations", checkLoggedInAdmin, (req, res, next) => {
		mostSellingItemWithRelationModule.getMostSellingItemsRelation(req, res, next);
	});

	/** Routing is used to export most_selling_items_with_relation**/
	app.get(reportModulePath + "/rest_most_selling_item_with_relations/export_data", checkLoggedInAdmin, (req, res, next) => {
		mostSellingItemWithRelationModule.exportMostSellingItemsRelation(req, res, next);
	});

	/** Routing is used to get order_payment_methods_report **/
	app.all(reportModulePath + "/order_payment_methods_report", checkLoggedInAdmin, (req, res, next) => {
		orderPaymentMethodModule.getOrderPaymentMethodsReportList(req, res, next);
	});

	/** Routing is used to export order_payment_methods_report**/
	app.get(reportModulePath + "/order_payment_methods_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		orderPaymentMethodModule.orderPaymentMethodsReportExport(req, res, next);
	});

	/** Routing is used to get cravez_sales_invoice_report **/
	app.all(reportModulePath + "/cravez_sales_invoice_report", checkLoggedInAdmin, (req, res, next) => {
		cravezSalesInvoiceModule.getCravezSalesInvoiceReportList(req, res, next);
	});

	/** Routing is used to export cravez_sales_invoice_report**/
	app.get(reportModulePath + "/cravez_sales_invoice_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		cravezSalesInvoiceModule.cravezSalesInvoiceReportExport(req, res, next);
	});
	/** Routing is used to get orders_report **/
	app.all(reportModulePath + "/orders_report", checkLoggedInAdmin, (req, res, next) => {
		ordersModule.getOrdersList(req, res, next);
	});

	/** Routing is used to export orders_report**/
	app.get(reportModulePath + "/orders_report/export_data", checkLoggedInAdmin, (req, res, next) => {
		ordersModule.ordersExportData(req, res, next);
	});
}





