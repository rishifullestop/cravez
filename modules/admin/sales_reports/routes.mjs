import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SalesReport from "./model/sales_report.mjs";
import RedeemEveryOfferReport from "./model/redeem_every_offer_report.mjs";
import CancellationReport from "./model/cancellation_report.mjs";
import RejectedReport from "./model/rejected_report.mjs";
import TotalOrderPerRestaurantWithOffersReport from "./model/total_order_per_restaurant_with_offers.mjs";
import TotalOrderPerRestaurantWithoutOffersReport from "./model/total_order_per_restaurant_without_offers.mjs";
import TotalOrderPerRestaurantReport from "./model/total_order_per_restaurant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure sales reports routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/sales_reports';
    const salesReportModule = new SalesReport(db);
	const redeemEveryOfferModule = new RedeemEveryOfferReport(db);
	const cancellationReportModule = new CancellationReport(db);
	const rejectedReportModule = new RejectedReport(db);
	const totalOrderPerRestaurantWithOffersModule = new TotalOrderPerRestaurantWithOffersReport(db);
	const totalOrderPerRestaurantWithoutOffersModule = new TotalOrderPerRestaurantWithoutOffersReport(db);
	const totalOrderPerRestaurantModule = new TotalOrderPerRestaurantReport(db);

    // Set views for all /sales-reports* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

	/** Routing is used to show searching page of sales report list **/
	router.all(modulePath,checkLoggedInAdmin,(req, res,next) => {
		salesReportModule.seachSection(req, res,next);
	});

	/** Routing is used to get branch list **/
	router.post(modulePath+"/branch_list",checkLoggedInAdmin,(req, res,next) => {
		salesReportModule.branchList(req, res,next); 
	});

	/** Routing is used to get total order per restaurant report list **/
	router.all(modulePath+"/total_order_per_restaurant",checkLoggedInAdmin,(req, res,next) => {
		totalOrderPerRestaurantModule.totalOrderPerRestaurant(req, res,next);
	});

	/** Routing is used to get Redeem every offer report list **/
	router.all(modulePath+"/redeem_every_offer_report",checkLoggedInAdmin,(req, res,next) => {
		redeemEveryOfferModule.redeemEveryOffer(req, res,next);
	});

	/** Routing is used to get cancellation order report list **/
	router.all(modulePath+"/cancellation_report",checkLoggedInAdmin,(req, res,next) => {
		cancellationReportModule.cancellationOrder(req, res,next);
	});

	/** Routing is used to get rejected order report list **/
	router.all(modulePath+"/rejected_report",checkLoggedInAdmin,(req, res,next) => {
		rejectedReportModule.rejectedOrder(req, res,next);
	});

	/** Routing is used to get total order per restaurant with selected the payment method report list **/
	router.all(modulePath+"/total_order_per_rest_with_payment_method",checkLoggedInAdmin,(req, res,next) => {
		totalOrderPerRestaurantModule.totalOrderPerRestaurantWithPaymentMethod(req, res,next);
	});

	/** Routing is used to get total order per restaurant with offers report list **/
	router.all(modulePath+"/total_order_per_rest_with_offers",checkLoggedInAdmin,(req, res,next) => {
		totalOrderPerRestaurantWithOffersModule.totalOrderPerRestaurantWithOffers(req, res,next);
	});

	/** Routing is used to get total order per restaurant without offers report list **/
	router.all(modulePath+"/total_order_per_rest_without_offers",checkLoggedInAdmin,(req, res,next) => {
		totalOrderPerRestaurantWithoutOffersModule.totalOrderPerRestaurantWithoutOffers(req, res,next);
	});

} 