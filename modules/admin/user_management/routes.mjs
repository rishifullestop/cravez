import { fileURLToPath } from 'url';
import { dirname } from 'path';

import userManagement from "./model/user_management.mjs";
import manageVehicle from "./model/manage_vehicle.mjs";
import { addEditDriverValidation, assignCategoryToCustomerValidation, addEditCustomerValidation, addEditVehicleValidation, assignVehicleValidation, addWalletAmountValidation} from "./validations.mjs";
import { validateRequest, convertMultipartReqBody} from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


/**
 * Configure customer routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(app, { db, checkLoggedInAdmin }) {
	const modulePath = '/user_management';
	const ManageVehicleModulePath = '/user_management/manage_vehicle/:driver_id';
	const userManagementModule = new userManagement(db);
	const manageVehicleModule  = new manageVehicle(db);

	/** Set current view folder **/
	app.use(modulePath,(req, res, next) => {
		req.rendering.views	=	__dirname + "/views";
		next();
	});

	/** Routing is used for listing driver **/
	app.all(modulePath+"/reclaim/:id",checkLoggedInAdmin,(req, res) => {
		userManagementModule.reclaim(req, res);
	});

	/** Routing is used for listing driver **/
	app.all(modulePath+"/list_driver",checkLoggedInAdmin,(req, res) => {
		userManagementModule.listDriver(req, res);
	});

	/** Routing is used to add driver **/
	app.all(modulePath+"/add_driver",checkLoggedInAdmin, addEditDriverValidation, validateRequest, (req, res,next) => {
		userManagementModule.addEditDriver(req, res, next);
	});

	/** Routing is used to edit driver **/
	app.all(modulePath+"/edit_driver/:id",checkLoggedInAdmin, addEditDriverValidation, validateRequest, (req, res,next) => {
		userManagementModule.addEditDriver(req, res, next);
	});

	/** Routing is used to delete driver **/
	app.all(modulePath+"/delete_driver/:id",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.deleteDriver(req, res, next);
	});

	/** Routing is used to view driver **/
	app.get(modulePath+"/view_driver/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.viewDriverDetails(req, res, next);
	});

	/** Routing is used to update driver status**/
	app.all(modulePath+"/update-driver-status/:id/:status",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.updateDriverStatus(req, res, next);
	});

	/** Routing is used to update driver status**/
	app.post(modulePath+"/driver_locations/:id",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.driverLocationList(req, res, next);
	});

	/** Routing is used to update multiple driver details**/
	app.post(modulePath+"/update-multiple-driver-details",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.updateMultipleDriverDetails(req, res, next);
	});


	/** Routing is used for listing customer **/
	app.all(modulePath+"/list_customer",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.listCustomer(req, res, next);
	});

	/** Routing is used to add customer **/
	app.all(modulePath+"/add_customer",checkLoggedInAdmin,addEditCustomerValidation, validateRequest, (req, res, next) => {
		userManagementModule.addEditCustomer(req, res, next);
	});

	/** Routing is used to edit customer **/
	app.all(modulePath+"/edit_customer/:id",checkLoggedInAdmin,addEditCustomerValidation, validateRequest, (req, res,next) => {
		userManagementModule.addEditCustomer(req, res, next);
	});

	/** Routing is used to delete customer **/
	app.all(modulePath+"/delete_customer/:id",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.deleteCustomer(req, res, next);
	});

	/** Routing is used to view customer **/
	app.get(modulePath+"/view_customer/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.viewCustomerDetails(req, res, next);
	});
	app.get(modulePath+"/view_customer/:id/:type",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.viewCustomerDetails(req, res, next);
	});

	/** Routing is used to view customer address **/
	app.get(modulePath+"/view_address/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.viewAddressDetails(req, res, next);
	});

	/** Routing is used to view customer **/
	app.get(modulePath+"/customer_details/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.customerDetails(req, res, next);
	});

	/** Routing is used to get customer order list **/
	app.all(modulePath+"/customer_order_list/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getCustomerOrderList(req, res, next);
	});

	/** Routing is used to get customer address list **/
	app.all(modulePath+"/customer_address_list/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getCustomerAddressList(req, res, next);
	});

	app.post(modulePath+"/customer_verification_process/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.verifyCustomer(req, res, next);
	});

	/** Routing is used to get customer package list **/
	app.all(modulePath+"/customer_package_list/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getPackagesList(req, res, next);
	});

	/** Routing is used to get customer refund details list **/
	app.all(modulePath+"/refund_detail/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getRefundList(req, res, next);
	});

	/** Routing is used to update customer status**/
	app.all(modulePath+"/update-customer-status/:id/:status",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.updateCustomerStatus(req, res, next);
	});

	/** Routing is used to assign category to customer **/
	app.all(modulePath+"/assign_category/:id",checkLoggedInAdmin,assignCategoryToCustomerValidation, validateRequest, (req, res, next) => {
		userManagementModule.assignCategoryToCustomer(req, res, next);
	});

	/** Routing is used to manage vehicle listing **/
	app.all(ManageVehicleModulePath,checkLoggedInAdmin,(req, res, next) => {
		manageVehicleModule.getManageVehicleList(req, res, next);
	});

	/** Routing is used to add vehicle **/
	app.all(ManageVehicleModulePath+"/add_vehicle",checkLoggedInAdmin,addEditVehicleValidation, validateRequest, (req, res,next) => {
		manageVehicleModule.addEditVehicle(req, res, next);
	});

	/** Routing is used to edit vehicle **/
	app.all(ManageVehicleModulePath+"/edit_vehicle/:id",checkLoggedInAdmin,addEditVehicleValidation, validateRequest, (req, res,next) => {
		manageVehicleModule.addEditVehicle(req, res, next);
	});

	/** Routing is used to assign vehicle to driver **/
	app.all(ManageVehicleModulePath+"/assign_vehicle",checkLoggedInAdmin,assignVehicleValidation, validateRequest, (req, res, next) => {
		manageVehicleModule.assignVehicleToDriver(req, res, next);
	});

	/** Routing is used to update  export user details **/
	app.all(ManageVehicleModulePath+"/export_data/:export_count/:export_type",checkLoggedInAdmin,(req,res,next)=>{
		manageVehicleModule.exportData(req,res,next);
	});


	/** Routing is used to mark user black list **/
	app.get(modulePath+"/update-customer-black-list/:id/:status",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.updateBlackListStatus(req, res, next);
	});

	/** Routing is used to get customer accounts list **/
	app.all(modulePath+"/customer_account_list/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getCustomerAccountList(req, res, next);
	});

	/** Routing is used to view customer wallet details **/
	app.get(modulePath+"/customer_wallet_details/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.customerWalletDetails(req, res, next);
	});

	/** Routing is used to add customer wallet amount **/
	app.all(modulePath+"/add_wallet_amount/:id",checkLoggedInAdmin,addWalletAmountValidation, validateRequest, (req, res, next)=>{
		userManagementModule.addWalletAmount(req, res, next);
	});

	/** Routing is used to view customer wallet transaction list **/
	app.all(modulePath+"/customer_wallet_transaction_list/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getCustomerWalletTransactionAndRewardPointsList(req, res, next);
	});

	/** Routing is used to get customer verification list **/
	app.all(modulePath+"/customer_verification_list/:id",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getCustomerVerificationList(req, res, next);
	});

	/** Routing is used to view customer reward points list **/
	app.all(modulePath+"/customer_reward_points_list/:id/:type",checkLoggedInAdmin,(req, res, next)=>{
		userManagementModule.getCustomerWalletTransactionAndRewardPointsList(req, res, next);
	});

	/** Routing is used to load map **/
	app.get(modulePath+"/load_map",checkLoggedInAdmin,(req, res, next) => {
		userManagementModule.loadMap(req,res,next);
	});
}

