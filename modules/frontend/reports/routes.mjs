import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as Constants from "../../../config/global_constant.mjs";

import coverageAreaModule from "./model/coverage_area_report.mjs";
import revenueGrowthModule from "./model/revenue_growth.mjs";
import revenueGeneratedModule from "./model/revenue_generated.mjs";
import orderGrowthModule from "./model/order_growth.mjs";
import operationReportModule from "./model/operation_report.mjs";
import transmissionTimeReportOneModule from "./model/transmission_time_report_one.mjs";
import avgUnitSoldMoMModule from "./model/average_unit_sold_report.mjs";
import performanceReportsModule from "./model/performance_report_sales.mjs";
import transmissionTimeReportModule from "./model/transmission_time_report.mjs";
import financialReportModule from "./model/financial_report.mjs";
import avgBasketSizeMoMModule from "./model/average_basket_size_report.mjs";
import menuEngineeringModule from "./model/menu_engineering_report.mjs";
import topContributionToLostRevenueModule from "./model/top_contribution_to_lost_revenue.mjs";
import lostRevenueGraphModule from "./model/lost_revenue_graph.mjs";
import customerOrderFrequencyModule from "./model/customer_order_frequency_report.mjs";
import topTenOrderedItemsModule from "./model/top_10_ordered_items_report.mjs";
import customerBreakdownModule from "./model/monthly_customer_breakdown_report.mjs";
import restaurantReportModule from "./model/restaurant_report_dashboard.mjs";
import failRateModule from "./model/fail_rate_graph.mjs";
import cancelledReasonBreakdownModule from "./model/cancelled_reason_breakdown.mjs";
import cancelledOrderModule from "./model/cancelled_order_graph.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);	

/**
 * Configure reports routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
	const modulePath = Constants.FRONT_END_NAME + "reports";

	const coverageAreaModel = new coverageAreaModule(db);
	const revenueGrowthModel = new revenueGrowthModule(db);
	const revenueGeneratedModel = new revenueGeneratedModule(db);
	const orderGrowthModel = new orderGrowthModule(db);
	const operationReportModel = new operationReportModule(db);
	const transmissionTimeReportOneModel = new transmissionTimeReportOneModule(db);
	const avgUnitSoldMoMModel = new avgUnitSoldMoMModule(db);
	const performanceReportsModel = new performanceReportsModule(db);
	const transmissionTimeReportModel = new transmissionTimeReportModule(db);
	const financialReportModel = new financialReportModule(db);
	const avgBasketSizeMoMModel = new avgBasketSizeMoMModule(db);
	const menuEngineeringModel = new menuEngineeringModule(db);
	const topContributionToLostRevenueModel = new topContributionToLostRevenueModule(db);
	const lostRevenueGraphModel = new lostRevenueGraphModule(db);
	const customerOrderFrequencyModel = new customerOrderFrequencyModule(db);
	const topTenOrderedItemsModel = new topTenOrderedItemsModule(db);
	const customerBreakdownModel = new customerBreakdownModule(db);
	const restaurantReportModel = new restaurantReportModule(db);
	const failRateModel = new failRateModule(db);
	const cancelledReasonBreakdownModel = new cancelledReasonBreakdownModule(db);
	const cancelledOrderModel = new cancelledOrderModule(db);	

	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + "/views";
		next();
	});

	/** Routing is used to get coverage area_report **/
	router.all(modulePath + "/coverage_area_report", checkLoggedIn, (req, res, next) => {
		coverageAreaModel.getCoverageAreaReport(req, res, next);
	});

	/** Routing is used to export coverage area report**/
	router.get(modulePath + "/coverage_area_report/export_data", checkLoggedIn, (req, res, next) => {
		coverageAreaModel.exportAreaSalesShare(req, res, next);
	});
	/** Routing is used to restaurant_city_area_dropdown**/
	router.post(modulePath + "/restaurant_city_area_dropdown", checkLoggedIn, (req, res, next) => {
		coverageAreaModel.areaDropdown(req, res, next);
	});

	/** Routing is used to get revenue growth graph **/
	router.all(modulePath + "/revenue_growth", checkLoggedIn, (req, res, next) => {
		revenueGrowthModel.getRevenueGrowthReport(req, res, next);
	});

	/** Routing is used to get revenue generated graph **/
	router.all(modulePath + "/revenue_generated", checkLoggedIn, (req, res, next) => {
		revenueGeneratedModel.getRevenueGeneratedReport(req, res, next);
	});

	/** Routing is used to export revenue growth graph **/
	router.get(modulePath + "/revenue_generated/export_data", checkLoggedIn, (req, res, next) => {
		revenueGeneratedModel.exportRevenueGeneratedReport(req, res, next);
	});

	/** Routing is used to get order growth graph **/
	router.all(modulePath + "/order_growth", checkLoggedIn, (req, res, next) => {
		orderGrowthModel.getOrderGrowthReport(req, res, next);
	});

	/** Routing is used to export order growth graph **/
	router.get(modulePath + "/order_growth/export_data", checkLoggedIn, (req, res, next) => {
		orderGrowthModel.exportOrderGrowthReport(req, res, next);
	});

	/** Routing is used to get operation report list **/
	router.all(modulePath+"/operation_report",checkLoggedIn,(req, res,next) => {
		operationReportModel.getOperationReportList(req, res,next);
	});

	/** Routing is used to get operation report export **/
	router.get(modulePath+"/operation_report/export_data",checkLoggedIn,(req, res,next) => {
		operationReportModel.getOperationReportExport(req, res,next);
	});

	/** Routing is used to get transmission time report list **/
	router.all(modulePath + "/transmission_time_report_one", checkLoggedIn, (req, res, next) => {
		transmissionTimeReportOneModel.getTransmissionTimeReportOneList(req, res, next);
	});

	/** Routing is used to get transmission time report export **/
	router.get(modulePath + "/transmission_time_report_one/export_data", checkLoggedIn, (req, res, next) => {
		transmissionTimeReportOneModel.getTransmissionTimeReportOneExport(req, res, next);
	});

	/** Routing is used to get average_unit_sold_mom report **/
	router.all(modulePath+"/average_unit_sold_report",checkLoggedIn,(req, res,next) => {
		avgUnitSoldMoMModel.avgUnitSoldMoM(req, res,next);
	});

	/** Routing is used to export average_unit_sold_mom report **/
	router.get(modulePath+"/average_unit_sold_report/export_data",checkLoggedIn,(req, res, next) => {
		avgUnitSoldMoMModel.avgUnitSoldMoMExport(req, res, next);
	});

	/** Routing is used to get performance_report_sales report **/
	router.all(modulePath+"/performance_report_sales",checkLoggedIn,(req, res,next) => {
		performanceReportsModel.getPerformanceReport(req, res,next);
	});

	/** Routing is used to export performance_report_sales report **/
	router.get(modulePath+"/performance_report_sales/export_data",checkLoggedIn,(req, res, next) => {
		performanceReportsModel.exportPerformanceReport(req, res, next);
	});

	/** Routing is used to get transmission time report list **/
	router.all(modulePath + "/transmission_time_report", checkLoggedIn, (req, res, next) => {
		transmissionTimeReportModel.getTransmissionTimeReportList(req, res, next);
	});

	/** Routing is used to get transmission time report export **/
	router.get(modulePath + "/transmission_time_report/export_data", checkLoggedIn, (req, res, next) => {
		transmissionTimeReportModel.getTransmissionTimeReportExport(req, res, next);
	});

	/** Routing is used to get transmission time report list **/
	router.all(modulePath + "/financial_report", checkLoggedIn, (req, res, next) => {
		financialReportModel.getFinancialReportList(req, res, next);
	});

	/** Routing is used to get transmission time report export **/
	router.get(modulePath + "/financial_report/export_data", checkLoggedIn, (req, res, next) => {
		financialReportModel.getFinancialReportExport(req, res, next);
	});

	/** Routing is used to get average_basket_size_report list **/
	router.all(modulePath + "/average_basket_size_report", checkLoggedIn, (req, res, next) => {
		avgBasketSizeMoMModel.avgBasketSizeMoM(req, res, next);
	});

	/** Routing is used to get average_basket_size_report export **/
	router.get(modulePath + "/average_basket_size_report/export_data", checkLoggedIn, (req, res, next) => {
		avgBasketSizeMoMModel.avgBasketSizeMoMExport(req, res, next);
	});

	/** Routing is used to get menu_engineering_report list **/
	router.all(modulePath + "/menu_engineering_report", checkLoggedIn, (req, res, next) => {
		menuEngineeringModel.getMenuEngineeringReportList(req, res, next);
	});

	/** Routing is used to get menu_engineering_report export **/
	router.get(modulePath + "/menu_engineering_report/export_data", checkLoggedIn, (req, res, next) => {
		menuEngineeringModel.exportMenuEngineeringReport(req, res, next);
	});

	/** Routing is used to get top contribution to lost revenue list **/
	router.all(modulePath + "/top_contribution_lost_revenue", checkLoggedIn, (req, res, next) => {
		topContributionToLostRevenueModel.getTopContributionLostRevenueList(req, res, next);
	});

	/** Routing is used to get top contribution to lost revenue export **/
	router.get(modulePath + "/top_contribution_lost_revenue/export_data", checkLoggedIn, (req, res, next) => {
		topContributionToLostRevenueModel.topContributionLostRevenueExportData(req, res, next);
	});

	/** Routing is used to get lost revenue graph list **/
	router.all(modulePath + "/lost_revenue_graph", checkLoggedIn, (req, res, next) => {
		lostRevenueGraphModel.getlostRevenueGraphReport(req, res, next);
	});

	/** Routing is used to get lost revenue graph export **/
	router.get(modulePath + "/lost_revenue_graph/export_data", checkLoggedIn, (req, res, next) => {
		lostRevenueGraphModel.exportLostRevenueGraphReport(req, res, next);
	});

	/** Routing is used to get customer order frequency report list **/
	router.all(modulePath + "/customer_order_frequency_report", checkLoggedIn, (req, res, next) => {
		customerOrderFrequencyModel.getCustomerOrderFrequencyReport(req, res, next);
	});

	/** Routing is used to get customer order frequency report export **/
	router.get(modulePath + "/customer_order_frequency_report/export_data", checkLoggedIn, (req, res, next) => {
		customerOrderFrequencyModel.exportCustomerOrderFrequencyReport(req, res, next);
	});

	/** Routing is used to get top ten ordered items report list **/
	router.all(modulePath + "/top_ten_ordered_items_report", checkLoggedIn, (req, res, next) => {
		topTenOrderedItemsModel.getTopTenOrderedItemsReport(req, res, next);
	});

	/** Routing is used to get top ten ordered items report export **/
	router.get(modulePath + "/top_ten_ordered_items_report/export_data", checkLoggedIn, (req, res, next) => {
		topTenOrderedItemsModel.exportTopTenOrderedItemsReport(req, res, next);
	});

	/** Routing is used to get monthly customer breakdown report **/
	router.all(modulePath + "/monthly_customer_breakdown_report", checkLoggedIn, (req, res, next) => {
		customerBreakdownModel.getCustomerBreakdownReport(req, res, next);
	});

	/** Routing is used to export monthly customer breakdown report**/
	router.get(modulePath + "/monthly_customer_breakdown_report/export_data", checkLoggedIn, (req, res, next) => {
		customerBreakdownModel.exportCustomerBreakdownReport(req, res, next);
	});

	/** Routing is used to get restaurant report dashboard**/
	router.all(modulePath + "/restaurant_report_dashboard", checkLoggedIn, (req, res, next) => {
		restaurantReportModel.getRestaurantReportDashboard(req, res, next);
	});

	/** Routing is used to get fail rate graph report **/
	router.all(modulePath + "/fail_rate_graph", checkLoggedIn, (req, res, next) => {
		failRateModel.getFailRateGraphList(req, res, next);
	});

	/** Routing is used to export fail rate graph report**/
	router.get(modulePath + "/fail_rate_graph/export_data", checkLoggedIn, (req, res, next) => {
		failRateModel.exportFailRateGraph(req, res, next);
	});

	/** Routing is used to get cancelled reason breakdown report **/
	router.all(modulePath + "/cancelled_reason_breakdown_report", checkLoggedIn, (req, res, next) => {
		cancelledReasonBreakdownModel.getCancelledReasonBreakdownList(req, res, next);
	});

	/** Routing is used to export cancelled reason breakdown report**/
	router.get(modulePath + "/cancelled_reason_breakdown_report/export_data", checkLoggedIn, (req, res, next) => {
		cancelledReasonBreakdownModel.CancelledReasonBreakdownExportData(req, res, next);
	});

	/** Routing is used to get cancelled order report **/
	router.all(modulePath + "/cancelled_order_graph", checkLoggedIn, (req, res, next) => {
		cancelledOrderModel.getCancelledOrderGraphReport(req, res, next);
	});

	/** Routing is used to export cancelled order report**/
	router.get(modulePath + "/cancelled_order_graph/export_data", checkLoggedIn, (req, res, next) => {
		cancelledOrderModel.exportCancelledOrderGraphReport(req, res, next);
	});
}