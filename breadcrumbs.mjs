import { WEBSITE_ADMIN_URL, WEBSITE_URL } from './config/global_constant.mjs';

export default {

	/** DASHBOARD SECTION**/
	'admin/dashboard' : [{name:'Dashboard',url:'',icon:'dashboard'}],
	'admin/dashboard/agent_login' : [{name:'Dashboard',url:WEBSITE_ADMIN_URL+'dashboard',icon:'dashboard'},{name:'Login/Logout time',url:'',icon:'dashboard'}],

	/**EDIT PROFILE SECTION**/
	'admin/user_profile/edit' : [{name:'Edit profile',url:'',icon:'mode_edit'}],

	/**MASTER MANAGEMENT SECTION**/
	'admin/master/list' : [{name:'dynamic_variable',url:'',icon:'subject'}],
	'admin/master/add' 	: [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'master/{dynamic_variable}',icon:'subject'},{name:'Add',url:'',icon:'add'}],
	'admin/master/edit' : [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'master/{dynamic_variable}',icon:'subject'},{name:'Edit',url:'',icon:'mode_edit'}],
	'admin/master/view' : [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'master/{dynamic_variable}',icon:'subject'},{name:'View',url:'',icon:'find_in_page'}],

	/**USER MANAGEMENT SECTION**/
	'admin/users/list' 		: 	[{name:'User Management',url:'',icon:'person'}],
	'admin/users/edit' 		: 	[{name:'User Management',url:WEBSITE_ADMIN_URL+'users',icon:'person'},{name:'Edit User',url:'',icon:'mode_edit'}],
	'admin/users/add'		: 	[{name:'User Management',url:WEBSITE_ADMIN_URL+'users',icon:'person'},{name:'Add User',url:'',icon:'person_add'}],
	'admin/users/view' 		:	[{name:'User Management',url:WEBSITE_ADMIN_URL+'users',icon:'person'},{name:'View User',url:'',icon:'find_in_page'}],

	/**PUBLIC COMPOSITE SECTION**/
	'admin/public_composite/list' 		: 	[{name:'Public Composite Offers',url:'',icon:'person'}],

	/**MANAGE VEHICLEs SECTION**/
	'admin/manage_vehicles/list' 	: 	[{name:'Manage Vehicles',url:'',icon:'vehicle'}],

	/**TEXT SETTING SECTION**/
	'admin/text_setting/list' : [{name:'dynamic_variable',url:'',icon:'text_format'}],
	'admin/text_setting/edit' : [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'text-setting/{dynamic_variable}',icon:'text_format'},{name:'Edit Text Setting',url:'',icon:'mode_edit'}],
	'admin/text_setting/add' : [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'text-setting/{dynamic_variable}',icon:'text_format'},{name:'Add Text Setting',url:'',icon:'add'}],

	/**EMAIL MANAGEMENT SECTION**/
	'admin/email_template/list' : [{name:'Email Templates',url:'',icon:'contact_mail'}],
	'admin/email_template/add'  : [{name:'Email Templates',url:WEBSITE_ADMIN_URL+'email_template',icon:'contact_mail'},{name:'Add email template',url:'',icon:'add'}],
	'admin/email_template/edit' : [{name:'Email Templates',url:WEBSITE_ADMIN_URL+'email_template',icon:'contact_mail'},{name:'Edit email template',url:'',icon:'mode_edit'}],

	/**ASSIGNMENT SLABS SECTION**/
	'admin/assignment_slabs/list' : [{name:'Assignment Slabs',url:'',icon:'contact_mail'}],

	/** EMAIL LOGS SECTION**/
	'admin/email_logs/list' : [{name:'Email Logs',url:'',icon:'mail_outline'}],
	'admin/email_logs/view' : [{name:'Email Logs',url:WEBSITE_ADMIN_URL+'email_logs',icon:'mail_outline'},{name:'Email Logs Details',url:'',icon:'find_in_page'}],

	/**SETTING MANAGEMENT SECTION**/
	'admin/setting/list' 	: [{name:'Settings',url:'',icon:'settings'}],
	'admin/setting/add'  	: [{name:'Settings',url:WEBSITE_ADMIN_URL+'settings',icon:'settings'},{name:'Add Setting',url:'',icon:'add'}],
	'admin/setting/edit' 	: [{name:'Settings',url:WEBSITE_ADMIN_URL+'settings',icon:'settings'},{name:'Edit Setting',url:'',icon:'mode_edit'}],
	'admin/setting/prefix' 	: [{name:'dynamic_variable',url:'',icon:'settings'}],

	/**ADMIN ROLE SECTION**/
	'admin/admin_role/list' : [{name:'Manage Roles',url:'',icon:'security'}],
	'admin/admin_role/add'  : [{name:'Manage Roles',url:WEBSITE_ADMIN_URL+'admin_role/{dynamic_variable}',icon:'security'},{name:'Add Role',url:'',icon:'add'}],
	'admin/admin_role/edit' : [{name:'Manage Roles',url:WEBSITE_ADMIN_URL+'admin_role/{dynamic_variable}',icon:'security'},{name:'Edit Role',url:'',icon:'edit'}],

	/**ADMIN PERMISSIONS SECTION**/
	'admin/admin_permissions/list': [{ name:'Team Manager',url:'',icon:'perm_data_setting'}],
	'admin/admin_permissions/add': [{ name: 'Team Manager', url: WEBSITE_ADMIN_URL + 'admin_permissions', icon: 'perm_data_setting' }, { name:'Add Team Member ',url:'',icon:'add'}],
	'admin/admin_permissions/edit': [{ name: 'Team Manager', url: WEBSITE_ADMIN_URL + 'admin_permissions', icon: 'perm_data_setting' }, { name:'Edit Team Member ',url:'',icon:'edit'}],
	'admin/admin_permissions/view': [{ name: 'Team Manager', url: WEBSITE_ADMIN_URL + 'admin_permissions', icon: 'perm_data_setting' }, { name:'View Team Member ',url:'',icon:'find_in_page'}],

	/** ADMIN MODULES SECTION**/
	'admin/admin_modules/list' : [{name:'Admin Modules',url:'',icon:'pages'}],
	'admin/admin_modules/add'  : [{name:'Admin Modules',url:WEBSITE_ADMIN_URL+'admin_modules/{dynamic_variable}',icon:'pages'},{name:'Add Admin Modules',url:'',icon:'add'}],
	'admin/admin_modules/edit' : [{name:'Admin Modules',url:WEBSITE_ADMIN_URL+'admin_modules/{dynamic_variable}',icon:'pages'},{name:'Edit Admin Modules',url:'',icon:'edit'}],

	/** NOTIFICATION SECTION**/
	'admin/notification/list' : [{name:'Notification Management',url:'',icon:'notifications'}],

	/** ADMIN notification types SECTION**/
	'admin/notification_types/list': [{name:'Notification Types',url:'',icon:'pages'}],

	/** ADMIN sms templates SECTION**/
	'admin/sms_template/list': [{name:'Sms Template',url:'',icon:'pages'}],

	/**TEXT GROUP SETTING SECTION**/
	'admin/text_group_setting/list' : [{name:'Text Group Setting',url:'',icon:'new_releases'}],
	'admin/text_group_setting/view' : [{name:'Text Group Setting',url:WEBSITE_ADMIN_URL+'text_group_setting',icon:'new_releases'},{name:'View Text Group Setting',url:'',icon:'find_in_page'}],
    'admin/text_group_setting/edit' : [{name:'View Text Group Setting ',url:WEBSITE_ADMIN_URL+'text_group_setting/{dynamic_variable}/view',icon:'text_format'},{name:'Edit Text Setting',url:'',icon:'mode_edit'}],
	'admin/text_group_setting/import' : [{name:'Text Group Setting',url:WEBSITE_ADMIN_URL+'text_group_setting',icon:'new_releases'},{name:'Import Text Group Setting',url:'',icon:'find_in_page'}],

	/** RESTAURANT PENDING BRANCHES **/
	'admin/restaurant_pending_branches/list': [{ name: 'Restaurant Pending Branches', url: '', icon: 'assessment' }],

	/** RESTAURANT SECTION **/
	'admin/restaurants/list': [{name:'Restaurants',url:'',icon:'restaurant'}],
	'admin/restaurants/pending_category' : [{name:'Pending Category Managers',url:'',icon:'restaurant'}],
	'admin/restaurants/pending_menu' : [{name:'Pending Menu Managers',url:'',icon:'restaurant'}],

	/**CMS SECTION**/
	'admin/cms/list' :	[{name:'CMS Management',url:'',icon:'picture_in_picture'}],
	'admin/cms/edit' : 	[{name:'CMS Management',url:WEBSITE_ADMIN_URL+'cms',icon:'picture_in_picture'},{name:'Edit CMS',url:'',icon:'mode_edit'}],
	'admin/cms/add'	 : 	[{name:'CMS Management',url:WEBSITE_ADMIN_URL+'cms',icon:'picture_in_picture'},{name:'Add CMS',url:'',icon:'add'}],

	/**Leave management**/
	'admin/leave_management/leave_master' :	[,{name:'Vacation Balance',url:'',icon:'picture_in_picture'}],
	'admin/leave_management/list' 		  : [{name:'Vacation Request',url:'',icon:'picture_in_picture'}],

	/**Driver Leave management**/
	'admin/driver_leave_management/list'  : [{name:'Captain Vacation Request',url:'',icon:'picture_in_picture'}],

	/**Corporate Tie Ups**/
	'admin/corporate_tie_ups/list'  : [{name:'Corporate Tie Ups',url:'',icon:'picture_in_picture'}],
	'admin/corporate_tie_ups/import_user': [{name:'Corporate Tie Ups',url:WEBSITE_ADMIN_URL+'corporate_tie_ups',icon:'picture_in_picture'},{name:'Import Users',url:'',icon:'find_in_page'}],

	/** FAQ SECTION **/
	'admin/faq/list': [{name:'FAQ Management',url:'',icon:'question_answer'}],
	'admin/faq/edit': [{name:'FAQ Management',url:WEBSITE_ADMIN_URL+'faqs',icon:'question_answer'},{name:'Edit FAQ',url:'',icon:'mode_edit'}],
	'admin/faq/add'	: [{name:'FAQ Management',url:WEBSITE_ADMIN_URL+'faqs',icon:'question_answer'},{name:'Add FAQ',url:'',icon:'add'}],
	'admin/faq/view': [{name:'FAQ Management',url:WEBSITE_ADMIN_URL+'faqs',icon:'question_answer'},{name:'View FAQ',url:'',icon:'find_in_page'}],

	/**SHIFT SETUP SECTION **/
	'admin/shift_setup/list': [{name:'Shift Setup',url:'',icon:'question_answer'}],
	'admin/shift_setup/edit': [{name:'Shift Setup',url:WEBSITE_ADMIN_URL+'shift_setup',icon:'question_answer'},{name:'Edit Shift',url:'',icon:'mode_edit'}],
	'admin/shift_setup/add'	: [{name:'Shift Setup',url:WEBSITE_ADMIN_URL+'shift_setup',icon:'question_answer'},{name:'Add Shift',url:'',icon:'add'}],
	'admin/shift_setup/team_schedule'	: [{name:'Team Schedule',url:'',icon:'add'}],

	/**DRIVER SHIFTS SECTION **/
	'admin/driver_shifts/list': [{name:'Captain Shifts',url:'',icon:'question_answer'}],

	/**Orders management**/
	'admin/orders/list'  : [{name:'Orders',url:'',icon:'question_answer'}],
	'admin/orders/view': [{name:'Orders',url:WEBSITE_ADMIN_URL+'Orders',icon:'question_answer'},{name:'View Orders',url:'',icon:'find_in_page'}],

	/**FLEET AREA ASSIGNMENT SECTION **/
	'admin/fleet_area_assignment/list': [{name:'Fleet Area Assignment',url:'',icon:'question_answer'}],


	/** CITIES SECTION **/
	'admin/city/list': [{name:'Cities',url:'',icon:'class'}],
	'admin/city/edit': [{name:'Cities',url:WEBSITE_ADMIN_URL+'cities',icon:'class'},{name:'Edit City',url:'',icon:'mode_edit'}],
	'admin/city/add' : [{name:'Cities',url:WEBSITE_ADMIN_URL+'cities',icon:'class'},{name:'Add City',url:'',icon:'add'}],

	/** AREAS SECTION **/
	'admin/area/list': [{name:'Areas',url:'',icon:'assignment'}],
	'admin/area/edit': [{name:'Areas',url:WEBSITE_ADMIN_URL+'areas',icon:'assignment'},{name:'Edit Area',url:'',icon:'mode_edit'}],
	'admin/area/add' : [{name:'Areas',url:WEBSITE_ADMIN_URL+'areas',icon:'assignment'},{name:'Add Area',url:'',icon:'add'}],

	/** TEAM BREAKS SECTION **/
	'admin/team_breaks/list': [{name:'Breaks',url:'',icon:'assessment'}],

	/** AREAS SECTION **/
	'admin/area_blocks/list': [{name:'Area Blocks',url:'',icon:'assignment'}],

	/** RESTAURANT ENQUIRY SECTION**/
	'admin/restaurant_enquiries': [{name:'Restaurant Enquiries ',url:'',icon:'question_answer'}],
	'admin/restaurant_enquiries/view' : [{name:'Restaurant Enquiries',url:WEBSITE_ADMIN_URL+'restaurant_enquiries',icon:'question_answer'},{name:'View Restaurant Enquiry',url:'',icon:'find_in_page'}],
	'admin/restaurant_enquiries/add' : [{name:'Restaurant Enquiries',url:WEBSITE_ADMIN_URL+'restaurant_enquiries',icon:'question_answer'},{name:'Add Restaurant Enquiry',url:'',icon:'add'}],
	'admin/restaurant_enquiries/approve_enquiry' : [{name:'Restaurant Enquiries',url:WEBSITE_ADMIN_URL+'restaurant_enquiries',icon:'question_answer'},{name:'Approve Restaurant',url:'',icon:'done_all'}],
	'admin/restaurant_enquiries/edit_restaurant' : [{name:'Restaurant Enquiries',url:WEBSITE_ADMIN_URL+'restaurant_enquiries',icon:'question_answer'},{name:'Edit Restaurant',url:'',icon:'mode_edit'}],

	/** IMPORT MANAGERS **/
	'admin/import_managers/list': [{name:'Import Managers',url:'',icon:'file_upload'}],

	/** MERCHANT UPLOAD SECTION **/
	'admin/merchant_upload/list': [{name:'Merchant Upload',url:'',icon:'file_upload'}],

	/** IMPORT MANAGERS **/
	'admin/ticket_management/list': [{name:'dynamic_variable',url:'',icon:'file_upload'}],
	'admin/ticket_management/view': [{name:'Ticket Details',url:''}],

	/** Survey Management **/
	'admin/survey_management/list': [{name:'Survey Management',url:'',icon:'file_upload'}],
	'admin/survey_management/add': [{name:'Survey Management',url:WEBSITE_ADMIN_URL+'survey_management',icon:'assignment'},{name:'Add Survey',url:'',icon:'add'}],
	'admin/survey_management/edit': [{name:'Survey Management',url:WEBSITE_ADMIN_URL+'survey_management',icon:'assignment'},{name:'Edit Survey',url:'',icon:'mode_edit'}],
	'admin/survey_management/view_graph': [{name:'Survey Management',url:WEBSITE_ADMIN_URL+'survey_management',icon:'assignment'},{name:'View Graph',url:'',icon:'mode_edit'}],
	'admin/survey_management/view': [{name:'Survey Management',url:WEBSITE_ADMIN_URL+'survey_management',icon:'assignment'},{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'survey_management/view_history/{dynamic_variable}',icon:'mode_edit'},{name:'Response Details',url:'',icon:'mode_edit'}],
	'admin/survey_management/view_history': [{name:'Survey Management',url:WEBSITE_ADMIN_URL+'survey_management',icon:'assignment'},{name:'View History',url:'',icon:'mode_edit'}],

	/** Task Assignment **/
	'admin/task_assignment/list': [{name:'Task Assignment',url:'',icon:'assignment'}],

	/** User Management **/
	'admin/user_management/list_driver': [{name:'Driver Management',url:'',icon:'file_upload'}],
	'admin/user_management/add_driver': [{name:'Driver Management',url:WEBSITE_ADMIN_URL+'user_management/list_driver',icon:'assignment'},{name:'Add Driver',url:'',icon:'add'}],
	'admin/user_management/edit_driver': [{name:'Driver Management',url:WEBSITE_ADMIN_URL+'user_management/list_driver',icon:'assignment'},{name:'Edit Driver',url:'',icon:'mode_edit'}],
	'admin/user_management/view_driver': [{name:'Driver Management',url:WEBSITE_ADMIN_URL+'user_management/list_driver',icon:'assignment'},{name:'View Driver',url:'',icon:'find_in_page'}],

	'admin/user_management/list_customer': [{name:'Customer Management',url:'',icon:'file_upload'}],
	'admin/user_management/add_customer': [{name:'Customer Management',url:WEBSITE_ADMIN_URL+'user_management/list_customer',icon:'assignment'},{name:'Add Customer',url:'',icon:'add'}],
	'admin/user_management/edit_customer': [{name:'Customer Management',url:WEBSITE_ADMIN_URL+'user_management/list_customer',icon:'assignment'},{name:'Edit Customer',url:'',icon:'mode_edit'}],
	'admin/user_management/view_customer': [{name:'Customer Management',url:WEBSITE_ADMIN_URL+'user_management/list_customer',icon:'assignment'},{name:'View Customer',url:'',icon:'find_in_page'}],


	/**ADMIN CATEGORY SECTION**/
	'admin/category/list' : [{name:'Ticket Categories',url:'',icon:'rotate_90_degrees_ccw'}],
	'admin/category/view' : [{name:'Ticket Categories',url:WEBSITE_ADMIN_URL+'category',icon:'rotate_90_degrees_ccw'},{name:'View Category',url:'',icon:'view_module'}],

	/** SUPER PACKAGES **/
	'admin/super_packages/list': [{name:'Super Packages',url:'',icon:'file_upload'}],

	/**ADMIN Over Time Management SECTION**/
	'admin/overtime_request/list' : [{name:'Overtime Request',url:'',icon:'show_chart'}],

	/**ADMIN Captain Over Time Management SECTION**/
	'admin/captain_overtime_request/list' : [{name:'Captain Overtime Request',url:'',icon:'show_chart'}],

	/** SLIDER MANAGEMENT **/
	'admin/slider_management/list': [{name:'dynamic_variable',url:'',icon:'file_upload'}],

	/** CUISINES SECTION **/
	'admin/cuisines/list': [{name:'Cuisines',url:'',icon:'class'}],
	'admin/cuisines/edit': [{name:'Cuisines',url:WEBSITE_ADMIN_URL+'cuisines',icon:'class'},{name:'Edit Cuisine',url:'',icon:'mode_edit'}],
	'admin/cuisines/add' : [{name:'Cuisines',url:WEBSITE_ADMIN_URL+'cuisines',icon:'class'},{name:'Add Cuisine',url:'',icon:'add'}],

	/** CUISINE PRIORITIES SECTION **/
	'admin/cuisine_priorities/list': [{name:'Cuisine Priorities',url:'',icon:'class'}],

	/** ATTRIBUTES SECTION **/
	'admin/attributes/list': [{name:'Attributes',url:'',icon:'class'}],
	'admin/attributes/edit': [{name:'Attributes',url:WEBSITE_ADMIN_URL+'attributes',icon:'class'},{name:'Edit Attribute',url:'',icon:'mode_edit'}],
	'admin/attributes/add' : [{name:'Attributes',url:WEBSITE_ADMIN_URL+'attributes',icon:'class'},{name:'Add Attribute',url:'',icon:'add'}],

	'admin/restaurants/pending_item': [{ name: 'Pending Item Manager', url: '', icon:'assignment'}],

	/** RESTAURANT CUISINES SECTION **/
	'admin/restaurant_cuisines/list': [{name:'Restaurant Cuisines',url:'',icon:'class'}],

	/** DRIVER BREAKS SECTION **/
	'admin/driver_breaks/list': [{name:'Captain Breaks',url:'',icon:'assessment'}],

	/**DRIVER ON OUT SHIFTS SECTION **/
	'admin/driver_in_out_shifts/list': [{name:'Captain In Out Shifts',url:'',icon:'assessment'}],

	/**DRIVER ON driver excuses SECTION **/
	'admin/driver_excuses/list': [{name:'Captain Excuses',url:'',icon:'assessment'}],

	/** ATTRIBUTE MANAGEMENT SECTION**/
	'admin/attribute_management/list' : [{name:'dynamic_variable',url:'',icon:'subject'}],
	'admin/attribute_management/add'  : [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'attribute_management/{dynamic_variable}',icon:'subject'},{name:'Add',url:'',icon:'add'}],
	'admin/attribute_management/edit' : [{name:'dynamic_variable',url:WEBSITE_ADMIN_URL+'attribute_management/{dynamic_variable}',icon:'subject'},{name:'Edit',url:'',icon:'mode_edit'}],

	/** OFFER MANAGEMENT SECTION **/
	'admin/offer_management/list': [{name:'Offer Management',url:'',icon:'assessment'}],

	/**CAPTAIN TRACKING SECTION **/
	'admin/captain_tracking/captain_tracking': [{name:'Captain Tracking',url:'',icon:'assessment'}],

	/** ADD IN WALLET SECTION **/
	'admin/add_in_wallet/list': [{name:'Add In Wallet',url:'',icon:'assessment'}],

	/** MANAGE VEHICLE SECTION **/
	'admin/manage_vehicle/list': [{name:'Driver Management',url:WEBSITE_ADMIN_URL+'user_management/list_driver',icon:'assignment'},{name:'Manage Vehicles',url:'',icon:'assessment'}],

	/** VOC MANAGEMENT SECTION **/
	'admin/voc_management/list': [{name:'VOC Management',url:'',icon:'class'}],
	'admin/voc_management/edit': [{name:'VOC Management',url:WEBSITE_ADMIN_URL+'voc_management',icon:'class'},{name:'Edit VOC',url:'',icon:'mode_edit'}],
	'admin/voc_management/add' : [{name:'VOC Management',url:WEBSITE_ADMIN_URL+'voc_management',icon:'class'},{name:'Add VOC',url:'',icon:'add'}],

	/** ORDER TRACKING SECTION **/
	'admin/order_tracking/order_tracking': [{name:'Order Tracking',url:'',icon:'assessment'}],

	/** BRANCH OFFER LINK SECTION **/
	'admin/branch_offer_link/list': [{name:'Generate Branch Offer Link',url:'',icon:'assessment'}],

	/** PAYMENT TRANSACTION SECTION **/
	'admin/payment_transaction/list': [{name:'Payment Transactions',url:'',icon:'assessment'}],

	/** EMAIL LOGS SECTION**/
	'admin/screen_visit_logs/list' : [{name:'Screen Visit Logs',url:'',icon:'mail_outline'}],

	/** REPORT SECTION**/
	'admin/report/customer_order_list' : [{name:'Customer Order Reports',url:'',icon:'assessment'}],
	'admin/report/restaurant_order_rate_report' : [{name:'Restaurant Order Rate Report',url:'',icon:'assessment'}],
	'admin/report/delivery_fees_revenue_report' : [{name:'Delivery Fees Revenue Report',url:'',icon:'assessment'}],
	'admin/report/revenue_commission_report' : [{name:'Revenue Commission Report',url:'',icon:'assessment'}],
	'admin/report/all_order_customer_guest_report' : [{name:'All Orders By Customer And Guest Report',url:'',icon:'assessment'}],
	'admin/report/sales_report' : [{name:'Sales Report',url:'',icon:'assessment'}],
	'admin/report/transmission_time_report' : [{name:'Transmission Time Report 2',url:'',icon:'assessment'}],
	'admin/report/transmission_time_report_one' : [{name:'Transmission Time Report 1',url:'',icon:'assessment'}],
	'admin/report/operation_report' : [{name:'Operation Performance Report',url:'',icon:'assessment'}],
	'admin/report/payment_report' : [{name:'Payment Status Report',url:'',icon:'assessment'}],
	'admin/report/restaurant_orders_count_report' : [{name:'Restaurant Orders Report',url:'',icon:'assessment'}],
	'admin/report/manual_wallet_refund_report' : [{name:'Manual Wallet Refund Report',url:'',icon:'assessment'}],
	'admin/report/order_count_report' : [{name:'Order Count Report',url:'',icon:'assessment'}],
	'admin/report/order_value_report' : [{name:'Order Value Report',url:'',icon:'assessment'}],
	'admin/report/daily_number_of_orders_report' : [{name:'Average Daily Number Of Orders',url:'',icon:'assessment'}],
	'admin/report/orders_per_governorate' : [{name:'Number Of Orders Per Governorate',url:'',icon:'assessment'}],
	'admin/report/average_unit_sold_report' : [{name:'Average Item Unit Sold MoM Report',url:'',icon:'assessment'}],
	'admin/report/average_basket_size_change_report': [{ name: 'Average Basket Size Change Report', url: '', icon: 'assessment' }],
	'admin/report/offer_only_customer_report' : [{name:'Offer Only Customer Report',url:'',icon:'assessment'}],
	'admin/report/customer_churn_report' : [{name:'Customer Churn Report',url:'',icon:'assessment'}],
	'admin/report/order_frequency_report' : [{name:'Order Frequency Report',url:'',icon:'assessment'}],
	'admin/report/custom_reports' : [{name:'Custom Reports',url:'',icon:'assessment'}],
	'admin/report/cuisine_sales_share_report' : [{name:'Cuisine Sales Share Report',url:'',icon:'assessment'}],
	'admin/report/customer_segmentation_report' : [{name:'Customer Segmentation Report',url:'',icon:'assessment'}],
	'admin/report/captain_wise_order_report' : [{name:'Captain Wise Orders Report',url:'',icon:'assessment'}],
	'admin/report/top_selling_items_report' : [{name:'Top Selling Items',url:'',icon:'assessment'}],
	'admin/report/most_selling_items_report' : [{name:'Most Selling Items With Areas',url:'',icon:'assessment'}],
	'admin/report/top_selling_restaurants' : [{name:'Top Selling Restaurants',url:'',icon:'assessment'}],
	'admin/report/restaurants_ranking_management': [{ name: 'Restaurants Ranking Management', url: '', icon: 'assessment' }],
	'admin/report/area_sales_share_report': [{ name: 'Area Sales Share Report', url: '', icon: 'assessment' }],
	'admin/report/number_of_customers_list' : [{name:'Number Of Customers Who Made First Order From Cravez',url:'',icon:'assessment'}],
	'admin/report/favourite_restaurant_report' : [{name:'Favourite Restaurant Report',url:'',icon:'assessment'}],
	'admin/report/favourite_cuisine_report' : [{name:'Favourite Cuisine Report',url:'',icon:'assessment'}],
	'admin/report/unsettled_payment_list': [{name:'Unsettled Payments',url:'',icon:'assessment'}],
	'admin/report/order_details': [{ name: 'Order Logs', url: '', icon: 'assessment' }],
	'admin/report/payment_history': [{ name: 'Payment History', url: '', icon: 'assessment' }],
	'admin/report/settled_payment_list': [{name:'Settled Payments',url:'',icon:'assessment'}],
	'admin/report/order_payment_cancel_report': [{name:'Order Payment Cancel Report',url:'',icon:'assessment'}],
	'admin/report/driver_petrol_consumption_report': [{name:'Captain Petrol Consumption Report',url:'',icon:'assessment'}],
	'admin/report/driver_petrol_consumption_details': [{name:'Captain Petrol Consumption Report',url:WEBSITE_ADMIN_URL+'report/driver_petrol_consumption_report',icon:'assessment'},{name:'Captain Petrol Consumption Details',url:'',icon:'assessment'}],
	'admin/report/cancelled_orders_contribution_report': [{ name: 'Cancelled Orders Contribution Report', url:'', icon: 'assessment' }],
	'admin/report/monthly_customer_breakdown_report': [{ name: 'Monthly customer breakdown', url:'', icon: 'assessment' }],
	'admin/report/restaurants_order_summary': [{ name: 'Restaurants Order Summary', url: '', icon: 'assessment' }],
	'admin/report/average_customer_order_value_report': [{ name: 'Average Customer Order Value Report', url: '', icon: 'assessment' }],
	'admin/report/redeem_every_offer_report': [{ name: 'Redeem Every Offer Report', url: '', icon: 'assessment' }],
	'admin/report/delivery_time_analysis_report': [{ name: 'Delivery Time Analysis Report', url: '', icon: 'assessment' }],
	'admin/report/driver_productivity_report': [{ name: 'Driver Productivity Report', url: '', icon: 'assessment' }],
	'admin/report/area_analysis_report': [{ name: 'Area Analysis Report', url: '', icon: 'assessment' }],
	'admin/report/captain_working_hours_report': [{ name: 'Captain Working Hours Report', url: '', icon: 'assessment' }],
	'admin/report/drivers_compliant_report': [{ name: 'Drivers Compliant Report', url: '', icon: 'assessment' }],
	'admin/report/customer_list': [{ name: 'Customer Management', url: '', icon: 'assessment' }],
	'admin/report/abandoned_cart_report': [{ name: 'Abandoned Cart Report', url: '', icon: 'assessment' }],
	'admin/report/drivers_report': [{ name: 'Drivers Report', url: '', icon: 'assessment' }],
	'admin/report/restaurant_performance_report': [{ name: 'Restaurant Performance Report', url: '', icon: 'assessment' }],
	'admin/report/area_performance_report': [{ name: 'Area Performance Report', url: '', icon: 'assessment' }],
	'admin/report/areas_contribution_report': [{ name: 'Areas Contribution Report', url: '', icon: 'assessment' }],
	'admin/report/cravez_orders_report': [{ name: 'Cravez Orders Report', url: '', icon: 'assessment' }],
	'admin/report/areas_contribution_half_yearly_report': [{ name: 'Areas Contribution Half Yearly Report', url: '', icon: 'assessment' }],
	'admin/report/cravez_orders_half_yearly_report': [{ name: 'Cravez Orders Half Yearly Report', url: '', icon: 'assessment' }],
	'admin/report/area_performance_half_yearly_report': [{ name: 'Area Performance Half Yearly Report', url: '', icon: 'assessment' }],
	'admin/report/restaurant_performance_half_yearly_report': [{ name: 'Restaurant Performance Half Yearly Report', url: '', icon: 'assessment' }],
	'admin/report/restaurant_busy_report': [{ name: 'Restaurant Busy Report', url: '', icon: 'assessment' }],
	'admin/report/restaurant_open_close_report': [{ name: 'Restaurant Open Close Report', url: '', icon: 'assessment' }],
	'admin/report/bi_analytics_report': [{ name: 'BI & Analytics Reports', url: '', icon: 'assessment' }],
	'admin/report/sales_staff_portfolio_report': [{ name: 'Sales Staff Portfolio Report', url: '', icon: 'assessment' }],
	'admin/report/order_payment_methods_report': [{ name: 'Order Payment Methods Report', url: '', icon: 'assessment' }],
	'admin/report/cravez_sales_invoice_report': [{ name: 'Cravez Sales Invoice Report', url: '', icon: 'assessment' }],
	'admin/report/most_selling_items_with_relations': [{ name: 'Restaurants Most Selling Items with Corelated Items', url: '', icon: 'assessment' }],
	'admin/report/orders_report': [{ name: 'Orders Report', url: '', icon: 'assessment' }],

	/** PN LOGS SECTION**/
	'admin/pn_logs/list' : [{name:'Pn Logs',url:'',icon:'assessment'}],

	/** CONTACT US SECTION**/
	'admin/contact/list' : [{name:'Contact Manager',url:'',icon:'assignment'}],
	'admin/contact/view': [{name:'Contact Manager',url:WEBSITE_ADMIN_URL+'contact',icon:'assignment'},{name:'View',url:'',icon:'find_in_page'}],

	/** PUBLIC HOLIDAYS SECTION**/
	'admin/public_holidays/list' : [{name:'Public Holidays',url:'',icon:'assessment'}],

	/** SALES REPORT SECTION**/
	'admin/sales_reports/sales_report_list' : [{name:'Sales Report',url:'',icon:'assessment'}],

	/**ADMIN Quality CATEGORY SECTION**/
	'admin/quality_category/list' : [{name:'Quality Categories',url:'',icon:'rotate_90_degrees_ccw'}],
	'admin/quality_category/view' : [{name:'Quality Categories',url:WEBSITE_ADMIN_URL+'quality_category',icon:'rotate_90_degrees_ccw'},{name:'View Category',url:'',icon:'view_module'}],

	/** SETTLED PAYMENTS SECTION **/
	'admin/avaya_monthly_reports/avaya_monthly_report_list': [{name:'Monthly Report',url:'',icon:'assessment'}],

	/** Avaya Quality Monitor section **/
	'admin/quality_monitor_form/list': [{name:'Quality Monitoring Sheet',url:'',icon:'assessment'}],
	'admin/quality_monitor_form/view' : [{name:'Quality Monitoring Report',url:'',icon:'view_module'}],

	/**Captain Assigned SECTION **/
	'admin/captain_assigned/list': [{name:'Captain Assigned',url:'',icon:'assessment'}],

	/**PUSH NOTIFICATION SECTION **/
	'admin/push_notifications/list': [{name:'Push Notifications',url:'',icon:'notifications_active'}],
	'admin/push_notifications/view' : [{name:'Push Notifications',url:WEBSITE_ADMIN_URL+'push_notifications',icon:'notifications_active'},{name:'View',url:'',icon:'view_module'}],

	/**KFG Areas SECTION **/
	'admin/kfg_areas/list': [{name:'KFG Areas',url:'',icon:'assessment'}],

	/** ORDER ASSIGNMENT SECTION **/
	'admin/order_assignment/list': [{name:'Order Assignment',url:'',icon:'assessment'}],

	/** ORDER ASSIGNMENT PROCESS SECTION **/
	'admin/order_assignment_process/list': [{name:'Order Assignment Process',url:'',icon:'assessment'}],

	/** ADS SLIDER SECTION **/
	'admin/ads_sliders/list': [{ name: 'Ads Sliders', url: '', icon: 'file_upload' }],
	'admin/ads_sliders/edit': [{ name: 'Ads Sliders', url: WEBSITE_ADMIN_URL + 'ads_sliders', icon: 'file_upload' }, { name: 'Edit Ads Sliders', url: '', icon: 'mode_edit' }],
	'admin/ads_sliders/add': [{ name: 'Ads Sliders', url: WEBSITE_ADMIN_URL + 'ads_sliders', icon: 'file_upload' }, { name: 'Add Ads Sliders', url: '', icon: 'add' }],

	/** SLIDER MANAGEMENT **/
	'admin/banner_management/list': [{name:'Banner Management',url:'',icon:'file_upload'}],
	'admin/banner_management/edit': [{ name: 'Banner Management', url: WEBSITE_ADMIN_URL + 'banner_management', icon: 'file_upload' }, { name: 'Edit Banner Management', url: '', icon: 'mode_edit' }],
	'admin/banner_management/add': [{ name: 'Banner Management', url: WEBSITE_ADMIN_URL + 'banner_management', icon: 'file_upload' }, { name: 'Add Banner Management', url: '', icon: 'add' }],


	/** Front Breadcrumbs */
		/** DASHBOARD SECTION**/
		'dashboard' : [{name:'Dashboard',url:'',icon:'dashboard'}],

		/** USER SECTION**/
		'users/edit_profile' : [{name:'Edit Profile',url:'',icon:'person'}],
		'users/change_password' : [{name:'Change Password',url:'',icon:'lock'}],
		'users/terms-and-conditions' : [{name:'Terms and Conditions',url:'',icon:'lock'}],

		/** MENU SECTION **/
		'menu/list': [{name:'Menu Manager',url:'',icon:'menu'}],
		'pending_menu/list': [{name:'Pending Menu Manager',url:'',icon:'menu'}],

		/** BRANCH SECTION **/
		'branch/list': [{name:'Restaurant branches',url:'',icon:'menu'}],

		/** PENDING BRANCH SECTION **/
		'pending_branch/list': [{name:'Pending restaurant branches',url:'',icon:'menu'}],

		/** CUISINES MANAGERS **/
		'cuisines/list': [{ name: 'Cuisines', url: '', icon:'assignment'}],

		/** ORDERS MANAGERS **/
		'orders/list': [{ name: 'dynamic_variable', url: '', icon:'assignment'}],
		'orders/view': [,{name:'Order Detail',url:'',icon:'find_in_page'}],

		/**NOTIFICATION SECTION */
		'notifications/list' : [{name:'Notifications',url:'',icon:'notifications'}],

		/** CATEGORY SECTION **/
		'category/list': [{name:'Category Manager',url:'',icon:'menu'}],
		'pending_category/list': [{name:'Pending Category Manager',url:'',icon:'menu'}],

		/** SIZE CATEGORY SECTION **/
		'size_category/list': [{name:'Size Category',url:'',icon:'menu'}],

		/** IMPORT MANAGER SECTION **/
		'import_managers/list': [{name:'Import Managers',url:'',icon:'file_upload'}],
		'import_managers/add' : [{ name: 'Import Managers', url: WEBSITE_URL + 'import_managers/', icon: 'file_upload' }, { name: ' Upload file', url: '', icon: 'add' }],


		/**USER PERMISSIONS SECTION**/
		'user_permissions/list': [{ name:'User Management',url:'',icon:'perm_data_setting'}],
		'user_permissions/add': [{ name: 'User Management', url: WEBSITE_URL + 'user_permissions', icon: 'perm_data_setting' }, { name:'Add User ',url:'',icon:'add'}],
		'user_permissions/edit': [{ name: 'User Management', url: WEBSITE_URL + 'user_permissions', icon: 'perm_data_setting' }, { name:'Edit User ',url:'',icon:'edit'}],
		'user_permissions/view': [{ name: 'User Management', url: WEBSITE_URL + 'user_permissions', icon: 'perm_data_setting' }, { name:'View User ',url:'',icon:'find_in_page'}],

		/** TICKET MANAGEMENT SECTION **/
		'tickets/list': [{name:'Ticket Management',url:'',icon:'class'}],
		'tickets/view': [{name:'Ticket Details',url:''}],

		/** Agent Time **/
		'admin/agent_time/list': [{name:'Agent Time',url:'',icon:'file_upload'}],

		/** CUISINES MANAGERS **/
		'cuisine_priorities/list': [{ name: 'Cuisine Priorities', url: '', icon:'assignment'}],

		/** ITEM MANAGERS **/
		'item/list': [{ name: 'Item Manager', url: '', icon:'assignment'}],

		/** PENDING ITEM MANAGERS **/
		'pending_item/list': [{ name: 'Pending Item Manager', url: '', icon:'assignment'}],

		/** Choice group **/
		'choice_group/choice_group_list': [{ name: 'Choice Group', url: '', icon:'assignment'}],

		/** pending choice group**/
		'pending_choice_group/pending_choice_group_list': [{ name: 'Pending Choice Group', url: '', icon:'assignment'}],

		/** EXTRA ITEMS **/
		'extra_items/extra_items_list': [{ name: 'Extra Items', url: '', icon:'assignment'}],

		/** PENDING EXTRA ITEMS **/
		'pending_extra_items/pending_extra_items_list': [{ name: 'Pending Extra Items', url: '', icon:'assignment'}],

		/** REPORT SECTION**/
		'reports/revenue_growth' : [{name:'Revenue Growth Graph',url:'',icon:'assessment'}],
		'reports/revenue_generated' : [{name:'Revenue Generated Graph',url:'',icon:'assessment'}],
		'reports/order_growth' : [{name:'Order Growth Graph',url:'',icon:'assessment'}],
		'reports/operation_report': [{ name: 'Operation Performance Report', url: '', icon: 'assessment' }],
		'reports/transmission_time_report_one': [{ name: 'Transmission Time Report 1', url: '', icon: 'assessment' }],
		'reports/average_unit_sold_report' : [{name:'Average Item Unit Sold MoM Report',url:'',icon:'assessment'}],
		'reports/coverage_area_report' : [{name:'Coverage Area Report ',url:'',icon:'assessment'}],
		'reports/performance_report_sales' : [{name:'Performance Report Sales',url:'',icon:'assessment'}],
		'reports/transmission_time_report': [{ name: 'Transmission Time Report 2', url: '', icon: 'assessment' }],
		'reports/financial_report': [{ name: 'Financial Report', url: '', icon: 'assessment' }],
		'reports/average_basket_size_report': [{ name: 'Average Basket Size MOM', url: '', icon: 'assessment' }],
		'reports/menu_engineering_report': [{ name: 'Menu Engineering Report', url: '', icon: 'assessment' }],
		'reports/top_contribution_lost_revenue': [{ name: 'Top Contribution To Lost Revenue Report', url: '', icon: 'assessment' }],
		'reports/lost_revenue_graph': [{ name: 'Lost Revenue Graph', url: '', icon: 'assessment' }],
		'reports/customer_order_frequency_report': [{ name: 'Customer Order Frequency Report', url: '', icon: 'assessment' }],
		'reports/top_ten_ordered_items_report': [{ name: 'Top 10 Ordered Items Report', url: '', icon: 'assessment' }],
		'reports/monthly_customer_breakdown_report': [{ name: 'Monthly Customer Breakdown Report', url: '', icon: 'assessment' }],
		'reports/restaurant_report_dashboard': [{ name: 'Performance Reports', url: '', icon: 'assessment' }],
};
