/** Permissions for front end */
export const PERMISSION_CLASSES = {
	"menu" : {
		"list":"permission_menu_list",
		"add":"permission_menu_add",
		"edit":"permission_menu_edit",
		"set_date_time":"permission_menu_set_date_time",
		"make_as_default":"permission_menu_make_as_default",
		"assign_branches":"permission_menu_assign_branches"
	},
	"orders":{
		"list":"permission_orders_list",
		"update_order_status":"permission_orders_update_order_status",
		"assign_captain":"permission_orders_assign_captain",
	},
	"order_rejected":{
		"list":"permission_order_rejected_list",
	},
	"order_cancelled":{
		"list":"permission_order_cancelled_list",
	},
	"order_detail":{
		"view":"permission_orders_view",
	},
	"print_receipt":{
		"print":"permission_orders_print",
	},
	"modify_orders":{
		"modify":"permission_orders_modify_orders",
	},
	"areas":{
		"list":"permission_areas_list"
	},
	"cuisines":{
		"list":"permission_cuisines_list",
		"select_cuisines":"permission_cuisines_select_cuisines",
	},
	"import_managers":{
		"list":"permission_import_managers_list",
		"add":"permission_import_managers_add",
		"download":"permission_import_managers_download",
	},
	"tickets":{
		"list":"permission_tickets_list",
		"add":"permission_tickets_add",
		"edit":"permission_tickets_edit",
		"view":"permission_tickets_view",
	},
	"category" : {
		"list":"permission_category_list",
		"add":"permission_category_add",
		"edit":"permission_category_edit",
		"active_deactive":"permission_category_active_deactive",
	},
	"user_permissions":{
		"list":"permission_user_permissions_list",
		"add":"permission_user_permissions_add",
		"edit":"permission_user_permissions_edit",
		"active_deactive":"permission_user_permissions_active_deactive",
		"delete":"permission_user_permissions_delete",
		"view":"permission_user_permissions_view",
		"send_login_credentials":"permission_user_permissions_send_login_credentials",
	},
	"change_password":{
		"list":""
	},
	"notification":{
		"list":"permission_notification_list"
	},
	"branches":{
		"list":"permission_branches_list",
		"add":"permission_branches_add",
		"branch_details":"permission_branches_branch_details",
		"branch_area":"permission_branches_branch_area",
		"branch_attribute":"permission_branches_branch_attribute",
		"branch_phones":"permission_branches_branch_phones",
		"branch_payment_methods":"permission_branches_branch_payment_methods",
		"branch_calendar":"permission_branches_branch_calendar",
		"send_for_approval":"permission_branches_send_for_approval",
		"active_deactive_open_close":"permission_branches_active_deactive_open_close",
		"cuisine_priorities":"permission_branches_cuisine_priorities",
	},
	"item" : {
		"list"				  :	"permission_item_list",
		"add"				  :	"permission_item_add",
		"edit"				  :	"permission_item_edit",
		"active_deactive"  	  :	"permission_item_active_deactive",
		"recommended_item"	  : "permission_item_recommended_item",
		"item_order"	   	  : "permission_item_order",
		"overriding"	   	  : "permission_item_overriding",
		"clone"			   	  : "permission_item_clone",
		"choice_group"		  : "permission_item_choice_group",
		"extra_items"		  : "permission_item_extra_items",
		"rollback"		  	  : "permission_item_rollback",
		"view"				  :	"permission_item_view",
		"send_for_approval"	  : "permission_item_send_for_approval",
		"upselling_item"	  : "permission_item_upselling_item",
		"branches_inactive"	  : "permission_item_branches_inactive",
		"extras_order"		  : "permission_item_extras_order",
	},
	"size_category" : {
		"list"  :"permission_size_category_list",
		"add"   :"permission_size_category_add",
		"edit"  :"permission_size_category_edit",
		"delete":"permission_size_category_delete",
	},
	"revenue_growth_report":{
		"list":"permission_revenue_growth_report_list",
	},
	"revenue_generated_report":{
		"list":"permission_revenue_generated_report_list",
	},
	"order_growth_report":{
		"list":"permission_order_growth_report_list",
	},
	"coverage_area_report":{
		"list":"permission_coverage_area_report_list",
	},
	"operation_report": {
		"list": "permission_operation_report_list",
	},
	"transmission_time_report_one": {
		"list": "permission_transmission_time_report_one_list",
	},
	"average_unit_sold_report":{
		"list":"permission_average_unit_sold_report_list",
	},
	"transmission_time_report": {
		"list": "permission_transmission_time_report_list",
	},
	"performance_report_sales": {
		"list": "permission_performance_report_sales_list",
	},
	"financial_report": {
		"list": "permission_financial_report_list",
	},
	"average_basket_size_report": {
		"list": "permission_average_basket_size_report_list",
	},
	"menu_engineering_report": {
		"list": "permission_menu_engineering_report_list",
	},
	"top_contribution_lost_revenue_report": {
		"list": "permission_top_contribution_lost_revenue_report_list",
	},
	"lost_revenue_graph": {
		"list": "permission_lost_revenue_graph_list",
	},
	"customer_order_frequency_report": {
		"list": "permission_customer_order_frequency_report_list",
	},
	"top_ten_ordered_items_report": {
		"list": "permission_top_ten_ordered_items_report_list",
	},
	"monthly_customer_breakdown_report": {
		"list": "permission_monthly_customer_breakdown_report_list",
	},
	"fail_rate_graph": {
		"list": "permission_fail_rate_graph_list",
	},
	"cancelled_reason_breakdown_report": {
		"list": "permission_cancelled_reason_breakdown_report_list",
	},
	"cancelled_order_graph": {
		"list": "permission_cancelled_order_graph_list",
	},
	"restaurant_report_dashboard": {
		"list": "permission_restaurant_report_dashboard_list",
	},
};

export const PERMISSIONS = {
	"notification" : {
		"list":{
			"title": "Notification",
			"paths":[
				"/notifications", "/notifications/get_header_notifications", "/notifications/get_header_notifications_counter"
			]
		},
	},
	"change_password" : {
		"list":{
			"title": "Change Password",
			"paths":[
				"/change_password"
			]
		},
	},
	"menu" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/menu","/:slug/pending_menu"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/menu/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/menu/edit/:id","/:slug/pending_menu/edit/:id"
			]
		},
		"assign_branches":{
			"title": "Asssign Branches",
			"paths":[
				"/:slug/menu/assign_branches/:id"
			]
		},
	},
	"cuisines" : {
		"list":{
			"title": "List",
			"paths":[
				"/cuisines", "/cuisines/linked_tags/:cuisine_id"
			]
		},
		"select_cuisines":{
			"title": "Select Cuisines",
			"paths":[
				"/cuisines/select_cuisines"
			]
		},
	},
	"orders" : {
		"list":{
			"title": "List",
			"paths":[
				"/orders/:order_status"
			]
		},
		"update_order_status":{
			"title": "Update Status",
			"paths":[
				"/orders/change_order_status/:id"
			]
		},
		"assign_captain":{
			"title": "Assign Captain",
			"paths":[
				"/orders/assign_captain"
			]
		},
	},
	"order_rejected" : {
		"list":{
			"title": "List",
			"paths":[
				"/orders/:order_status",
				"/orders/get_not_confirm_order_id",
				"/orders/update_order_status/:id/:order_status"
			]
		},
	},
	"order_cancelled" : {
		"list":{
			"title": "List",
			"paths":[
				"/orders/:order_status",
				"/orders/get_not_confirm_order_id",
				"/orders/update_order_status/:id/:order_status"
			]
		},
	},
	"order_detail" : {
		"view":{
			"title": "View",
			"paths":[
				"/orders/view/:id",
				"/orders/list_items/:order_id"
			]
		},
	},
	"print_receipt" : {
		"print":{
			"title": "Print Receipt",
			"paths":[
				"/orders/print/:order_id"
			]
		},
	},
	"modify_orders":{
		"modify":{
			"title": "Modify Order",
			"paths":[
				"/modify_orders/change_quantity/:order_id/:item_id/:extra_param?",
				"/modify_orders/add_items/:order_id",
				"/modify_orders/get_choice_item",
				"/modify_orders/update_new_items",
				"/modify_orders/delete_item_cart",
				"/modify_orders/add_multiple_item_cart/:order_id",
				"/modify_orders/my_cart/:order_id",
				"/modify_orders/apply_coupon",
				"/modify_orders/place_order",
			]
		},
	},
	"import_managers" : {
		"list":{
			"title": "List",
			"paths":[
				"/import_managers",
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/import_managers/add"
			]
		},
		"download":{
			"title": "Download",
			"paths":[
				"/import_managers/download/:id"
			]
		},
	},
	"areas" : {
		"list":{
			"title": "List",
			"paths":[
				"/areas"
			]
		}
	},
	"category" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/category","/:slug/pending_category"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/category/add","/:slug/pending_category/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/category/edit/:id","/:slug/pending_category/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active / Deactive",
			"paths":[
				"/:slug/pending_category/update-status/:id/:status",
				"/:slug/category/update-status/:id/:status"
			]
		},
	},
	"tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets","/tickets/get_category",
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/tickets/add","/tickets/get_category"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/tickets/edit/:id","/tickets/get_category"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/tickets/view/:id","tickets/add_comment"
			]
		},
	},
	"user_permissions" : {
		"list":{
			"title": "List",
			"paths":[
				"/user_permissions"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/user_permissions/add", "/user_permissions/get_role_modules"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/user_permissions/edit/:id", "/user_permissions/get_role_modules"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/user_permissions/update-status/:id/:status"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/user_permissions/delete/:id"
			]
		}
	},
	"branches" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/pending_branches/:id?",
				"/:slug/branches/:id?",
				"/:slug/branches",
				"/:slug/pending_branches",
				"/:slug/branches/get_area_list",
				"/:slug/branches/get_block_list",
			]
		},
		"add":{
			"title": "Add Branch",
			"paths":[
				"/:slug/branches/add"
			]
		},
		"branch_details":{
			"title": "Branch Details",
			"paths":[
				"/:slug/branches/view/:id",
				"/:slug/branches/branch_detail/:id",
				"/:slug/branches/edit/:id",

				/** Pending branch  */
				"/:slug/pending_branches/view/:id",
				"/:slug/pending_branches/branch_detail/:id",
				"/:slug/pending_branches/update/:id",
			]
		},
		"branch_area":{
			"title": "Covered Areas",
			"paths":[
				"/:slug/branches/branch_areas/:id",
				"/:slug/branches/add_branch_areas/:id",
				"/:slug/branches/get_branch_area_settings/:id",
				"/:slug/branches/update_branch_area_status/:id",
				"/:slug/branches/save_branch_area_settings/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_areas/:id",
				"/:slug/pending_branches/add_branch_areas/:id",
				"/:slug/pending_branches/get_branch_area_settings/:id",
				"/:slug/pending_branches/update_branch_area_status/:id",
				"/:slug/pending_branches/save_branch_area_settings/:id",
			]
		},
		"branch_attribute":{
			"title": "Branch Attributes",
			"paths":[
				"/:slug/branches/branch_attributes/:id",
				"/:slug/branches/save_branch_attributes/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_attributes/:id",
				"/:slug/pending_branches/save_branch_attributes/:id",
			]
		},
		"branch_phones":{
			"title": "Branch Phones",
			"paths":[
				"/:slug/branches/branch_phones/:id",
				"/:slug/branches/add_phone_number/:id",
				"/:slug/branches/update_phone_number/:id/:phone_number_id",
				"/:slug/branches/delete_phone_number/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_phones/:id",
				"/:slug/pending_branches/add_phone_number/:id",
				"/:slug/pending_branches/update_phone_number/:id/:phone_number_id",
				"/:slug/pending_branches/delete_phone_number/:id",
			]
		},
		"branch_payment_methods":{
			"title": "Branch Payment methods",
			"paths":[
				"/:slug/branches/branch_payments/:id",
				"/:slug/branches/save_payment_methods/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_payments/:id",
				"/:slug/pending_branches/save_payment_methods/:id",
			]
		},
		"branch_calendar":{
			"title": "Branch Calendar",
			"paths":[
				"/:slug/branches/branch_calendars/:id",
				"/:slug/branches/add_branch_calendar/:id",
				"/:slug/branches/delete_calendar/:id",
				"/:slug/branches/get_calendar_child_details/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_calendars/:id",
				"/:slug/pending_branches/add_branch_calendar/:id",
				"/:slug/pending_branches/delete_calendar/:id",
				"/:slug/pending_branches/get_calendar_child_details/:id",
			]
		},
		"send_for_approval":{
			"title": "Send For Approval",
			"paths":[
				"/:slug/pending_branches/send_for_approval/:id"
			]
		},
		"active_deactive_open_close":{
			"title": "Active / Deactive / Open / Busy",
			"paths":[
				"/:slug/branches/update-branch-status"
			]
		},
		"cuisine_priorities":{
			"title": "Cuisine Priorities",
			"paths":[
				"/cuisine_priorities/:restaurant_id/:branch_id",
				"/cuisine_priorities/:restaurant_id/:branch_id/get_approve_list",
				"/cuisine_priorities/:restaurant_id/:branch_id/approve",
				"/cuisine_priorities/:restaurant_id/:branch_id/reject",
			]
		},
	},
	"item" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/item/:id?","/:slug/item","/:slug/pending_item","/:slug/pending_item/:id?"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/item/add"
			]
		},
		"rollback":{
			"title": "Rollback",
			"paths":[
				"/:slug/item/rollback/:item"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/item/edit/:id","/:slug/pending_item/edit/:id",
			]
		},
		"active_deactive":{
			"title": "Active / Deactive",
			"paths":[
				"/:slug/item/update-status"
			]
		},
		"recommended_item":{
			"title": "Recommended Item",
			"paths":[
				"/:slug/item/recommended_item/:item_id"
			]
		},
		"overriding":{
			"title": "Overriding",
			"paths":[
				"/:slug/item/overriding/:item"
			]
		},
		"branches_inactive":{
			"title": "Inactive Branches",
			"paths":[
				"/:slug/item/branches_inactive/:item"
			]
		},
		"item_order":{
			"title": "Item Order",
			"paths":[
				"/:slug/item/item_order/:item"
			]
		},
		"clone":{
			"title": "Clone",
			"paths":[
				"/:slug/item/clone/:item"
			]
		},
		"extras_order" :{
			"title": "Extras Order",
			"paths":[
				"/:slug/item/extras_order/:item"
			]
		},
		"choice_group":{
			"title": "Choice Group",
			"paths":[
				"/:slug/choice_group/:item_id","/:slug/pending_choice_group/:item_id",
				"/:slug/choice_group/:item_id/add","/:slug/pending_choice_group/:item_id/add",
				"/:slug/choice_group/:item_id/edit/:id","/:slug/pending_choice_group/:item_id/edit/:id",
				"/:slug/choice_group/:item_id/add_extra/:id","/:slug/pending_choice_group/:item_id/add_extra/:id",
				"/:slug/choice_group/:item_id/delete/:id","/:slug/pending_choice_group/:item_id/delete/:id",
				"/:slug/choice_group/:item_id/clone/:id",
				"/:slug/choice_group/:item_id/get_item_list",
			]
		},
		"extra_items":{
			"title": "Extra Items",
			"paths":[
				"/:slug/extra_items/:item_id","/:slug/pending_extra_items/:item_id",
				"/:slug/extra_items/:item_id/add","/:slug/pending_extra_items/:item_id/add",
				"/:slug/extra_items/:item_id/edit/:id","/:slug/pending_extra_items/:item_id/edit/:id",
				"/:slug/extra_items/:item_id/delete/:id",
				"/:slug/extra_items/:item_id/update-extra-item-status",
				"/:slug/extra_items/:item_id/clone_extra_item/:id",
				"/:slug/extra_items/:item_id/get_item_list",
				"/:slug/extra_items/:item_id/extra_item_order/:id",
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/:slug/item/view/:id","/:slug/pending_item/view/:id",
			]
		},
		"send_for_approval":{
			"title": "Send For Approval",
			"paths":[
				"/:slug/pending_item/send_for_approval/:id",
			]
		},
		"upselling_item":{
			"title": "Upselling Item",
			"paths":[
				"/:slug/item/upselling_item/:item_id"
			]
		},
	},
	"size_category" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/size_category"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/size_category/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/size_category/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/:slug/size_category/delete/:id"
			]
		},
	},
	"revenue_growth_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/reports/revenue_growth"
			]
		},
	},
	"revenue_generated_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/reports/revenue_generated"
			]
		},
	},
	"order_growth_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/reports/order_growth"
			]
		},
	},
	"coverage_area_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/reports/coverage_area_report",
				"/reports/restaurant_city_area_dropdown"
			]
		},
	},
	"operation_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/operation_report"
			]
		},
	},
	"transmission_time_report_one": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/transmission_time_report_one"
			]
		},
	},
	"average_unit_sold_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/reports/average_unit_sold_report"
			]
		},
	},
	"transmission_time_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/transmission_time_report_two"
			]
		},
	},
	"performance_report_sales": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/performance_report_sales",
				"/reports/restaurant_city_area_dropdown"

			]
		},
	},
	"financial_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/financial_report"
			]
		},
	},
	"average_basket_size_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/average_basket_size_report"
			]
		},
	},
	"menu_engineering_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/menu_engineering_report"
			]
		},
	},
	"top_contribution_lost_revenue_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/top_contribution_lost_revenue_report"
			]
		},
	},
	"lost_revenue_graph": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/lost_revenue_graph"
			]
		},
	},
	"customer_order_frequency_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/customer_order_frequency_report"
			]
		},
	},
	"top_ten_ordered_items_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/top_ten_ordered_items_report"
			]
		},
	},
	"monthly_customer_breakdown_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/monthly_customer_breakdown_report"
			]
		},
	},
	"fail_rate_graph": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/fail_rate_graph"
			]
		},
	},
	"cancelled_reason_breakdown_report": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/cancelled_reason_breakdown_report"
			]
		},
	},
	"cancelled_order_graph": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/cancelled_order_graph"
			]
		},
	},
	"restaurant_report_dashboard": {
		"list": {
			"title": "List",
			"paths": [
				"/reports/restaurant_report_dashboard",
				"/reports/order_growth",
				"/reports/revenue_growth",
				"/reports/average_unit_sold_report",
				"/reports/average_basket_size_report",
				"/reports/fail_rate_graph",
				"/reports/customer_order_frequency_report",
				"/reports/lost_revenue_graph",
				"/reports/top_contribution_lost_revenue",
				"/reports/top_ten_ordered_items_report",
				"/reports/cancelled_order_graph",
				"/reports/cancelled_reason_breakdown_report",
				"/reports/revenue_generated",
				"/reports/monthly_customer_breakdown_report"
			]
		},
	},
};

/** Permissions for admin */
export const ADMIN_PERMISSION_CLASSES = {
	"corporate_tie_ups" : {
		"list":"permission_corporate_tie_ups_list",
		"add":"permission_corporate_tie_ups_add",
		"edit":"permission_corporate_tie_ups_edit",
		"import_user":"permission_corporate_tie_ups_import_user",
	},
	"public_composite" : {
		"list":"permission_public_composite_list",
		"edit":"permission_public_composite_edit",
		"update_status":"permission_public_composite_update_status",
	},
	"menu" : {
		"list":"permission_menu_list",
		"add":"permission_menu_add",
		"edit":"permission_menu_edit",
		"admin_action":"permission_menu_status",
		"assign_branches":"permission_menu_assign_branches",
	},
	"areas":{
		"list":"permission_areas_list",
		"add":"permission_areas_add",
		"edit":"permission_areas_edit",
		"active_deactive":"permission_areas_active_deactive",
		"export":"permission_areas_export"
	},
	"area_blocks":{
		"list":"permission_area_blocks_list",
		"add":"permission_area_blocks_add",
		"edit":"permission_area_blocks_edit",
		"active_deactive":"permission_area_blocks_active_deactive"
	},
	"cities":{
		"list":"permission_cities_list",
		"add":"permission_cities_add",
		"edit":"permission_cities_edit"
	},
	"assignment_slabs":{
		"list":"permission_assignment_slabs_list",
	},
	"team_breaks":{
		"list":"permission_team_breaks_list",
		"add":"permission_team_breaks_add",
		"delete":"permission_team_breaks_delete",
		"approve_reject":"permission_team_breaks_approve_reject",
	},
	"shift_setup":{
		"list":"permission_shift_setup_list",
		"add":"permission_shift_setup_add",
		"edit":"permission_shift_setup_edit",
		"delete":"permission_shift_setup_delete",
		"assign_shift":"permission_shift_setup_assign_shift",
		"team_schedule":"permission_shift_setup_team_schedule",
		"user_schedule":"permission_shift_setup_user_schedule",
		"export_schedule":"permission_shift_setup_export_schedule",
		"user_schedule"  : "permission_shift_setup_user_schedule"
	},
	"driver_shifts":{
		"list":"permission_driver_shifts_list",
		"add":"permission_driver_shifts_add",
		"edit":"permission_driver_shifts_edit",
		"delete":"permission_driver_shifts_delete",
		"assign_shift":"permission_driver_shifts_assign_shift",
		"team_schedule":"permission_driver_shifts_team_schedule",
		"user_schedule":"permission_driver_shifts_user_schedule",
		"export_schedule":"permission_driver_shifts_export_schedule",
	},
	"fleet_area_assignment":{
		"list":"permission_fleet_area_assignment_list",
		"add":"permission_fleet_area_assignment_add",
		"edit":"permission_fleet_area_assignment_edit",
	},
	"leave_master":{
		"leave_master":"permission_leave_management_leave_master",
	},
	"orders":{
		"list":"permission_orders_list",
		"accept_reject":"permission_orders_accept_reject",
		"change_status":"permission_orders_change_status",
		"change_address":"permission_orders_change_address",
		"cancel_order":"permission_orders_cancel_order",
		"reschedule_order":"permission_orders_reschedule_order",
		"modify_orders":"permission_orders_modify_orders",
		"export":"permission_orders_export",
		"refund_amount" : "permission_orders_refund_amount",
		"confirm_status" : "permission_orders_confirm_status",
		"show_hide_map" : "permission_orders_show_hide_map",
	},
	"order_detail":{
		"view":"permission_order_detail_view",
		"financial_info":"permission_order_detail_financial_info",
		"delivery_info":"permission_order_detail_delivery_info",
		"addresses":"permission_order_detail_addresses",
		"client_info":"permission_order_detail_client_info",
		"offer_dtail":"permission_order_detail_offer_dtail",
		"order_items":"permission_order_detail_order_items",
		"order_status":"permission_order_detail_order_status",
		"location_map":"permission_order_detail_location_map",
		"voc_client":"permission_order_detail_voc_client",
		"add_voc_client":"permission_order_detail_add_voc_client",
		"voc_captain":"permission_order_detail_voc_captain",
		"add_voc_captain":"permission_order_detail_add_voc_captain",
		"ticket_list":"permission_order_detail_ticket_list",
		"refund_and_compensation_list":"permission_order_detail_refund_and_compensation_list",
		"restaurant_details":"permission_order_detail_restaurant_details",
		"show_hide_map" : "permission_orders_show_hide_map",
	},
	"vacation_request":{
		"list":"permission_vacation_request_list",
		"add":"permission_vacation_request_add",
		"add_weekly_off":"permission_vacation_request_add_weekly_off",
		"edit_weekly_off":"permission_vacation_request_edit_weekly_off",
		"edit":"permission_vacation_request_edit",
		"delete":"permission_vacation_request_delete",
		"view":"permission_vacation_request_view",
		"export":"permission_vacation_request_export",
		"update_request_status":"permission_vacation_request_update_request_status",
	},
	"driver_vacation_request":{
		"list":"permission_driver_vacation_request_list",
		"add":"permission_driver_vacation_request_add",
		"add_weekly_off":"permission_driver_vacation_request_add_weekly_off",
		"edit_weekly_off":"permission_driver_vacation_request_edit_weekly_off",
		"edit":"permission_driver_vacation_request_edit",
		"delete":"permission_driver_vacation_request_delete",
		"view":"permission_driver_vacation_request_view",
		"export":"permission_driver_vacation_request_export",
		"update_request_status": "permission_driver_vacation_request_update_request_status",
	},
	"task_assignment":{
		"list":"permission_task_assignment_list",
		"add":"permission_task_assignment_add",
		"edit":"permission_task_assignment_edit",
		"delete":"permission_task_assignment_delete",
		"view":"permission_task_assignment_view",
	},
	"email_template":{
		"list":"permission_email_template_list",
		"add" :"permission_email_template_add",
		"edit":"permission_email_template_edit",
	},
	"restaurant_enquiries":{
		"list":"permission_restaurant_enquiries_list",
		"approve_reject":"permission_restaurant_enquiries_approve",
		"add":"permission_restaurant_enquiries_add",
		"view":"permission_restaurant_enquiries_view",
		"delete":"permission_restaurant_enquiries_delete",
		"update":"permission_restaurant_enquiries_update",
		"download":"permission_restaurant_enquiries_download",
	},
	"cms":{
		"list":"permission_cms_list",
		"add":"permission_cms_add",
		"edit":"permission_cms_edit",
		"delete":"permission_cms_delete",
	},
	"admin_modules":{
		"list":"permission_admin_modules_list",
		"add":"permission_admin_modules_add",
		"edit":"permission_admin_modules_edit",
		"active_deactive":"permission_admin_modules_active_deactive",
		"delete":"permission_admin_modules_delete",
	},
	"admin_permissions":{
		"list":"permission_admin_permissions_list",
		"add":"permission_admin_permissions_add",
		"edit":"permission_admin_permissions_edit",
		"active_deactive":"permission_admin_permissions_active_deactive",
		"delete":"permission_admin_permissions_delete",
		"view":"permission_admin_permissions_view",
		"send_login_credentials":"permission_admin_permissions_send_login_credentials",
		"assign_shift":"permission_admin_permissions_assign_shift",
	},
	"admin_role":{
		"list":"permission_admin_role_list",
		"add":"permission_admin_role_add",
		"edit":"permission_admin_role_edit",
		"delete":"permission_admin_role_delete",
	},
	"import_managers":{
		"list":"permission_import_managers_list",
		"active_deactive":"permission_import_managers_active_deactive",
		"download":"permission_import_managers_download",
	},
	"ads_sliders": {
		"list": "permission_ads_sliders_list",
		"add": "permission_ads_sliders_add",
		"edit": "permission_ads_sliders_edit",
		"delete": "permission_ads_sliders_delete",
	},
	"category" : {
		"list":"permission_category_list",
		"add":"permission_category_add",
		"edit":"permission_category_edit",
		"approve_reject":"permission_category_approve_reject",
		"active_deactive":"permission_category_active_deactive",
	},
	"faq" : {
		"list":"permission_faq_list",
		"add":"permission_faq_add",
		"edit":"permission_faq_edit",
		"delete":"permission_faq_delete",
		"update_status":"permission_faq_update_status",
	},
	"master" : {
		"list":"permission_master_list",
		"add":"permission_master_add",
		"edit":"permission_master_edit",
		"update_status":"permission_master_update_status",
	},
	"settings" : {
		"list":"permission_settings_list",
		"add": "permission_settings_add",
		"edit": "permission_settings_edit",
		"delete": "permission_settings_delete",
	},
	"notification":{
		"list":"permission_notification_list"
	},
	"notification_types":{
		"list":"permission_notification_types_list",
		"edit":"permission_notification_types_edit",
	},
	"sms_templates":{
		"list":"permission_sms_templates_list",
		"edit":"permission_sms_templates_edit",
	},
	"restaurants":{
		"list":"permission_restaurants_list"
	},
	"branches":{
		"list":"permission_branches_list",
		"add":"permission_branches_add",
		"branch_details":"permission_branches_branch_details",
		"branch_area":"permission_branches_branch_area",
		"branch_attribute":"permission_branches_branch_attribute",
		"branch_phones":"permission_branches_branch_phones",
		"branch_payment_methods":"permission_branches_branch_payment_methods",
		"branch_calendar":"permission_branches_branch_calendar",
		"update_status":"permission_branches_update_status",
		"active_deactive_open_close":"permission_branches_active_deactive_open_close",
		"cuisine_priorities":"permission_branches_cuisine_priorities",
	},
	"all_tickets":{
		"list":"permission_all_tickets_list",
	},
	"my_tickets":{
		"list":"permission_my_tickets_list",
		"add":"permission_my_tickets_add",
	},
	"incoming_tickets":{
		"list":"permission_incoming_tickets_list",
	},
	"close_tickets":{
		"list":"permission_close_tickets_list",
	},
	"reopen_tickets":{
		"list":"permission_reopen_tickets_list",
	},
	"qa_comment_tickets":{
		"list":"permission_qa_comment_tickets_list"
	},
	"ticket_details":{
		"view":"permission_ticket_details_view",
		"ticket_checkin":"permission_ticket_details_checkin",
		"export":"permission_ticket_details_export",
	},
	"ticket_update":{
		"edit":"permission_ticket_update_edit",
	},
	"survey_management":{
		"list":"permission_survey_management_list",
		"add" :"permission_survey_management_add",
		"edit":"permission_survey_management_edit",
		"view":"permission_survey_management_view",
		"view_graph":"permission_survey_management_view_graph",
		"make_live":"permission_survey_management_make_live",
		"delete":"permission_survey_management_delete",
		"view_history":"permission_survey_management_view_history",
	},
	"driver_management":{
		"list":"permission_driver_management_list",
		"add" :"permission_driver_management_add",
		"edit":"permission_driver_management_edit",
		"view":"permission_driver_management_view",
		"delete":"permission_driver_management_delete",
		"active_deactive":"permission_driver_management_active_deactive",
		"manage_vehicle":"permission_driver_management_manage_vehicle",
	},
	"customer_management":{
		"list":"permission_customer_management_list",
		"add" :"permission_customer_management_add",
		"edit":"permission_customer_management_edit",
		"delete":"permission_customer_management_delete",
		"active_deactive":"permission_customer_management_active_deactive",
		"assign_category":"permission_customer_management_assign_category",
		"blacklist":"permission_customer_management_blacklist",
		"export": "permission_customer_management_export",
	},
	"user_detail":{
		"customer_detail":"permission_user_detail_customer_detail",
		"order_list" :"permission_user_detail_order_list",
		"address_list":"permission_user_detail_address_list",
		"package_list":"permission_user_detail_package_list",
		"compensation_list":"permission_user_detail_compensation_list",
		"account_list":"permission_user_detail_account_list",
		"wallet_details":"permission_user_detail_wallet_details",
		"wallet_transaction_list":"permission_user_detail_wallet_transaction_list",
		"verification_list":"permission_user_detail_verification_list",
		"ticket_list":"permission_user_detail_ticket_list",
		"voc_list":"permission_user_detail_voc_list",
		"payment_transaction_list":"permission_user_detail_payment_transaction_list",
		"reward_points_list":"permission_user_detail_reward_points_list",
		"view_address":"permission_user_detail_view_address",
		"add_wallet_amount":"permission_user_detail_add_wallet_amount",
	},
	"ticket_category":{
		"list":"permission_ticket_category_list",
		"add" :"permission_ticket_category_add",
		"edit":"permission_ticket_category_edit",
		"view":"permission_ticket_category_view",
		"delete":"permission_ticket_category_delete",
	},
	"merchant_upload":{
		"list":"permission_merchant_upload_list"
	},
	"overtime_request":{
		"list":"permission_overtime_request_list",
		"add":"permission_overtime_request_add"
	},
	"overtime_captain_request":{
		"list":"permission_overtime_captain_request_list",
		"add":"permission_overtime_captain_request_add"
	},
	"super_packages":{
		"list":"permission_super_packages_list",
		"add":"permission_super_packages_add",
		"edit":"permission_super_packages_edit",
		"delete":"permission_super_packages_delete"
	},
	"slider_management":{
		"list":"permission_slider_management_list",
		"add":"permission_slider_management_add",
		"edit":"permission_slider_management_edit",
		"delete":"permission_slider_management_delete",
		"update_status":"permission_slider_management_update_status"
	},
	"banner_management": {
		"list": "permission_banner_management_list",
		"add": "permission_banner_management_add",
		"edit": "permission_banner_management_edit",
		"delete": "permission_banner_management_delete",
		"update_status": "permission_banner_management_update_status"
	},
	"cuisines":{
		"list":"permission_cuisines_list",
		"add":"permission_cuisines_add",
		"edit":"permission_cuisines_edit",
		"active_deactive":"permission_cuisines_active_deactive",
		"select_cuisine_priority":"permission_cuisines_select_cuisine_priority"
	},
	"attributes":{
		"list"	      : "permission_attributes_list",
		"add"	      : "permission_attributes_add",
		"edit"		  : "permission_attributes_edit",
		"delete"	  : "permission_attributes_delete",
		"change_order": "permission_attributes_change_order"
	},
	"item" : {
		"list"				   : "permission_item_list",
		"add"				   : "permission_item_add",
		"edit"			 	   : "permission_item_edit",
		"active_deactive"  	   : "permission_item_active_deactive",
		"admin_action"  	   : "permission_item_admin_action",
		"recommended_item" 	   : "permission_item_recommended_item",
		"overriding"	   	   : "permission_item_overriding",
		"item_order"	   	   : "permission_item_order",
		"clone"			   	   : "permission_item_clone",
		"branches_inactive"	   : "permission_item_branches_inactive",
		"rollback"			   : "permission_item_rollback",
		"choice_group"		   : "permission_item_choice_group",
		"extra_items"		   : "permission_item_extra_items",
		"view"				   : "permission_item_view",
		"send_for_approval"	   : "permission_item_send_for_approval",
		"upselling_item" 	   : "permission_item_upselling_item",
	},
	"size_category" : {
		"list":"permission_size_category_list",
		"add" :"permission_size_category_add",
		"edit":"permission_size_category_edit",
		"delete":"permission_size_category_delete",
	},
	"restaurant_cuisines":{
		"list"			 :"permission_restaurant_cuisines_list",
		"select_cuisines":"permission_restaurant_cuisines_select_cuisines",
	},
	"driver_breaks":{
		"list":"permission_driver_breaks_list",
		"delete":"permission_driver_breaks_delete",
		"approve_reject":"permission_driver_breaks_approve_reject",
		"add":"permission_driver_breaks_add",
		"end":"permission_driver_breaks_end"
	},
	"manage_vehicles":{
		"list":"permission_manage_vehicles_list",
		"export" : "permission_manage_vehicles_export",
		"add":"permission_manage_vehicles_add",
		"edit":"permission_manage_vehicles_edit"
	},
	"driver_in_out_shifts":{
		"list" :"permission_driver_in_out_shifts_list",
	},
	"driver_excuses":{
		"list":"permission_driver_excuses_list",
		"approve_reject":"permission_driver_excuses_approve_reject",
		"delete":"permission_driver_excuses_delete"
	},
	"attribute_management":{
		"list":"permission_attribute_management_list",
		"add":"permission_attribute_management_add",
		"edit":"permission_attribute_management_edit",
		"delete":"permission_attribute_management_delete",
	},
	"captain_tracking":{
		"list":"permission_captain_tracking_list",
		"voc_list": "permission_captain_tracking_voc_list",
		"ticket_list": "permission_captain_tracking_ticket_list",
		"captain_stats": "permission_captain_tracking_captain_stats",
		"add_voc": "permission_captain_tracking_add_voc",
		"add_ticket": "permission_captain_tracking_add_ticket",
	},
	"offer":{
		"list":"permission_offer_list",
		"add":"permission_offer_add",
		"edit":"permission_offer_edit",
		"active_deactive":"permission_offer_active_deactive"
	},
	"add_in_wallet":{
		"list":"permission_add_in_wallet_list",
		"add":"permission_add_in_wallet_add",
	},
	"voc_management":{
		"list":"permission_voc_management_list",
		"add" :"permission_voc_management_add",
		"edit":"permission_voc_management_edit",
		"active_deactive":"permission_voc_management_active_deactive",
	},
	"order_tracking":{
		"list":"permission_order_tracking_list",
		"accept_reject":"permission_order_tracking_accept_reject",
		"change_status":"permission_order_tracking_change_status",
		"change_address":"permission_order_tracking_change_address",
		"cancel_order":"permission_order_tracking_cancel_order",
		"assign":"permission_order_tracking_assign",
		"reschedule_order":"permission_order_tracking_reschedule_order",
		"undo_assign":"permission_order_tracking_undo_assign",
		"confirm_status":"permission_order_tracking_confirm_status",
		"show_hide_map" : "permission_order_tracking_show_hide_map",
	},
	"branch_offer_link":{
		"list":"permission_branch_offer_link_list",
		"add" :"permission_branch_offer_link_add",
	},
	"payment_transaction":{
		"list":"permission_payment_transaction_list",
	},
	"customer_order_report":{
		"list":"permission_customer_order_report_list",
		"export":"permission_customer_order_report_export",
	},
	"payment_report":{
		"list":"permission_payment_status_list",
		"export":"permission_payment_status_export"
	},
	"public_holidays" : {
		"list":"permission_public_holidays_list"
	},
	"sales_reports" : {
		"list":"permission_sales_report_list"
	},
	"unsettled_payments" : {
		"list"			 :"permission_unsettled_payments_list",
		"order_details"  :"permission_unsettled_payments_order_details",
		"payment_history":"permission_unsettled_payments_payment_history",
		"pay"			 :"permission_unsettled_payments_pay",
		"export"		 :"permission_unsettled_payments_export",
		"export_order_logs"	:"permission_unsettled_payments_export_order_logs",
	},
	"settled_payments" : {
		"list":"permission_settled_payments_list",
		"export":"permission_settled_payments_export",
		"order_details"  :"permission_settled_payments_order_details",
		"export_order_logs"	:"permission_settled_payments_export_order_logs",
	},
	"restaurant_orders_report":{
		"list":"permission_restaurant_orders_report_list",
		"export":"permission_restaurant_orders_report_export",
	},
	"manual_wallet_refund_report":{
		"list":"permission_manual_wallet_refund_report_list",
		"export":"permission_manual_wallet_refund_report_export",
	},
	"order_count_report":{
		"list":"permission_order_count_report_list",
		"export":"permission_order_count_report_export",
	},
	"order_value_report":{
		"list":"permission_order_value_report_list",
		"export":"permission_order_value_report_export",
	},
	"orders_per_governorate":{
		"list":"permission_orders_per_governorate_report_list",
		"export":"permission_orders_per_governorate_report_export",
	},
	"captain_wise_order_report":{
		"list":"permission_captain_wise_order_report_list",
		"export":"permission_captain_wise_order_report_export",
	},
	"average_daily_number_of_orders":{
		"list":"permission_average_daily_number_of_orders_list",
		"export":"permission_average_daily_number_of_orders_export",
	},
	"top_selling_items":{
		"list":"permission_top_selling_items_list",
		"export":"permission_top_selling_items_export",
	},
	"most_selling_items":{
		"list":"permission_most_selling_items_list",
		"export":"permission_most_selling_items_export",
	},
	"quality_category":{
		"list":"permission_quality_category_list",
		"add" :"permission_quality_category_add",
		"edit":"permission_quality_category_edit",
		"view":"permission_quality_category_view",
		"delete":"permission_quality_category_delete",
	},
	"quality_monitor_form":{
		"list":"permission_quality_monitor_form_list",
	},
	"monthly_performance":{
		"list":"permission_monthly_performance_form_list",
	},
	"number_of_customers":{
		"list":"permission_number_of_customers_list",
		"export":"permission_number_of_customers_export",
	},
	"favourite_restaurant_report":{
		"list":"permission_favourite_restaurant_list",
		"export":"permission_favourite_restaurant_export",
	},
	"favourite_cuisine_report":{
		"list":"permission_favourite_cuisine_list",
		"export":"permission_favourite_cuisine_export",
	},
	"order_payment_cancel_report":{
		"list":"permission_order_payment_cancel_report_list",
		"export": "permission_order_payment_cancel_report_export",
	},
	"push_notifications":{
		"list":"permission_push_notifications_list",
		"add":"permission_push_notifications_add",
		"view":"permission_push_notifications_view",
		"delete":"permission_push_notifications_delete",
		"get_user_list":"permission_push_notifications_get_user_list",
	},
	"captain_assigned":{
		"list":"permission_captain_assigned_list",
	},
	"kfg_areas":{
		"list":"permission_kfg_areas_list",
		"assign_area" : "permission_kfg_areas_assign_area",
		"assign_block" : "permission_kfg_areas_assign_block"
	},
	"order_assignment":{
		"list":"permission_order_assignment_list",
	},
	"order_assignment_process":{
		"list":"permission_order_assignment_process_list",
	},
	"driver_petrol_consumption_report":{
		"list":"permission_driver_petrol_consumption_report_list",
		"view":"permission_driver_petrol_consumption_report_view",
		"export":"permission_driver_petrol_consumption_detail_export",
	},
	"average_unit_sold_report":{
		"list":"permission_average_unit_sold_report_list",
		"export":"permission_average_unit_sold_report_export",
	},
	"average_basket_size_change_report": {
		"list": "permission_average_basket_size_change_report_list",
		"export": "permission_average_basket_size_change_report_export",
	},
	"offer_only_customer_report":{
		"list":"permission_offer_only_customer_report_list",
		"export":"permission_offer_only_customer_report_export",
	},
	"cuisine_sales_share_report":{
		"list":"permission_cuisine_sales_share_report_list",
		"export":"permission_cuisine_sales_share_report_export",
	},
	"customer_segmentation_report":{
		"list":"permission_customer_segmentation_report_list",
		"export":"permission_customer_segmentation_report_export",
	},
	"customer_churn_report":{
		"list":"permission_customer_churn_report_list",
		"export":"permission_customer_churn_export",
	},
	"order_frequency_report":{
		"list":"permission_order_frequency_report_list",
		"export":"permission_order_frequency_export",
	},
	"restaurant_order_rate_report":{
		"list":"permission_restaurant_order_rate_report_list",
		"export":"permission_restaurant_order_rate_export",
	},
	"transmission_time_report":{
		"list":"permission_transmission_time_report_list",
		"export":"permission_transmission_time_report_export",
	},
	"transmission_time_report_one": {
		"list": "permission_transmission_time_report_one_list",
		"export": "permission_transmission_time_report_one_export",
	},
	"operation_report":{
		"list":"permission_operation_report_list",
		"export":"permission_operation_report_export",
	},
	"delivery_fees_revenue_report":{
		"list":"permission_delivery_fees_revenue_report_list",
		"export":"permission_delivery_fees_revenue_export",
	},
	"revenue_commission_report":{
		"list":"permission_revenue_commission_report_list",
		"export":"permission_revenue_commission_export",
	},
	"all_order_customer_guest_report": {
		"list": "permission_all_order_customer_guest_report_list",
		"export": "permission_all_order_customer_guest_report_export",
	},
	"sales_report":{
		"list":"permission_sales_report_report_list",
		"export":"permission_sales_report_report_export",
	},
	"custom_reports":{
		"list":"permission_custom_reports_list",
		"export":"permission_custom_reports_export",
	},
	"top_selling_restaurants":{
		"list":"permission_top_selling_restaurants_list",
		"export":"permission_top_selling_restaurants_export",
	},
	"restaurants_ranking_management": {
		"list": "permission_restaurants_ranking_management_list",
		"export": "permission_restaurants_ranking_management_export",
	},
	"restaurant_busy_report": {
		"list": "permission_restaurant_busy_report_list",
		"export": "permission_restaurant_busy_report_export",
	},
	"restaurants_order_summary": {
		"list": "permission_restaurants_order_summary_list",
		"export": "permission_restaurants_order_summary_export",
	},
	"area_sales_share_report": {
		"list"	: "permission_area_sales_share_report_list",
		"export": "permission_area_sales_share_report_export",
	},
	"cancelled_orders_contribution_report": {
		"list": "permission_cancelled_orders_contribution_report_list",
		"export": "permission_cancelled_orders_contribution_report_export",
	},
	"monthly_customer_breakdown_report": {
		"list": "permission_monthly_customer_breakdown_report_list",
		"export": "permission_monthly_customer_breakdown_report_export",
	},
	"customer_report_server": {
		"list": "permission_customer_report_server_list",
		"export": "permission_customer_report_server_export",
	},
	"customer_report": {
		"list": "permission_customer_report_list",
		"export": "permission_customer_report_export",
	},
	"average_customer_order_value_report": {
		"list": "permission_average_customer_order_value_report_list",
		"export": "permission_average_customer_order_value_report_export",
	},
	"redeem_every_offer_report": {
		"list": "permission_redeem_every_offer_report_list",
		"export": "permission_redeem_every_offer_report_export",
	},
	"delivery_time_analysis_report": {
		"list": "permission_delivery_time_analysis_report_list",
		"export": "permission_delivery_time_analysis_report_export",
	},
	"driver_productivity_report": {
		"list": "permission_driver_productivity_report_list",
		"export": "permission_driver_productivity_report_export",
	},
	"area_analysis_report": {
		"list": "permission_area_analysis_report_list",
		"export": "permission_area_analysis_report_export",
	},
	"captain_working_hours_report": {
		"list": "permission_captain_working_hours_report_list",
		"export": "permission_captain_working_hours_report_export",
	},
	"drivers_compliant_report": {
		"list": "permission_drivers_compliant_report_list",
		"export": "permission_drivers_compliant_report_export",
	},
	"abandoned_cart_report": {
		"list": "permission_abandoned_cart_report_list",
		"export": "permission_abandoned_cart_report_export",
	},
	"drivers_report": {
		"list": "permission_drivers_report_list",
		"export": "permission_drivers_report_export",
	},
	"restaurant_performance_report": {
		"list": "permission_restaurant_performance_report_list",
		"export": "permission_restaurant_performance_report_export",
	},
	"area_performance_report": {
		"list": "permission_area_performance_report_list",
		"export": "permission_area_performance_report_export",
	},
	"areas_contribution_report": {
		"list": "permission_areas_contribution_report_list",
		"export": "permission_areas_contribution_report_export",
	},
	"cravez_orders_report": {
		"list": "permission_cravez_orders_report_list",
		"export": "permission_cravez_orders_report_export",
	},
	"areas_contribution_half_yearly_report": {
		"list": "permission_areas_contribution_half_yearly_report_list",
		"export": "permission_areas_contribution_half_yearly_report_export",
	},
	"cravez_orders_half_yearly_report": {
		"list": "permission_cravez_orders_half_yearly_report_list",
		"export": "permission_cravez_orders_half_yearly_report_export",
	},
	"area_performance_half_yearly_report": {
		"list": "permission_area_performance_half_yearly_report_list",
		"export": "permission_area_performance_half_yearly_report_export",
	},
	"restaurant_performance_half_yearly_report": {
		"list": "permission_restaurant_performance_half_yearly_report_list",
		"export": "permission_restaurant_performance_half_yearly_report_export",
	},
	"restaurant_open_close_report": {
		"list": "permission_restaurant_open_close_report_list",
		"export": "permission_restaurant_open_close_report_export",
	},
	"bi_analytics_report": {
		"list": "permission_bi_analytics_report_list",
		"export": "permission_bi_analytics_report_export",
	},
	"sales_staff_portfolio_report": {
		"list": "permission_sales_staff_portfolio_report_list",
		"export": "permission_sales_staff_portfolio_report_export",
	},
	"order_payment_methods_report": {
		"list": "permission_order_payment_methods_report_list",
		"export": "permission_order_payment_methods_report_export",
	},
	"cravez_sales_invoice_report": {
		"list": "permission_cravez_sales_invoice_report_list",
		"export": "permission_cravez_sales_invoice_report_export",
	},
	"most_selling_items_with_relation": {
		"list": "permission_most_selling_items_with_relation_list",
		"export": "permission_most_selling_items_with_relation_export",
	},
	"orders_report": {
		"list": "permission_orders_report_list",
		"export": "permission_orders_report_export",
	},
};

export const ADMIN_PERMISSIONS = {
	"corporate_tie_ups" : {
		"list":{
			"title": "List",
			"paths":[
				"/corporate_tie_ups"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/corporate_tie_ups/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/corporate_tie_ups/edit/:id"
			]
		},
		"import_user":{
			"title": "Import User",
			"paths":[
				"/corporate_tie_ups/import_user/:id"
			]
		},
	},
	"public_composite" : {
		"list":{
			"title": "List",
			"paths":[
				"/public_composite"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/public_composite/edit/:id",
				"/public_composite/add"
			]
		},
		"update_status":{
			"title": "Update Status",
			"paths":[
				"/public_composite/update_status/:id"
			]
		}
	},
	"menu" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/menu",'/:slug/pending_menu',"/restaurant_menu","/pending_menu"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/menu/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/menu/edit/:id",'/:slug/pending_menu/edit/:id'
			]
		},
		"admin_action":{
			"title": "In-Review / Approve / Disapprove",
			"paths":[
				'/:slug/pending_menu/review_reject',
				'/:slug/pending_menu/approve',
				'/pending_menu/update_multiple_status'
			]
		},
		"assign_branches":{
			"title": "Asssign Branches",
			"paths":[
				"/:slug/menu/assign_branches/:id"
			]
		},
	},
	"areas" : {
		"list":{
			"title": "List",
			"paths":[
				"/areas"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/areas/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/areas/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/areas/update-status/:id/:status"
			]
		},
		"export":{
			"title": "Export Details",
			"paths":[
				"/areas/export_data/:export_count/:export_type"
			]
		},
	},
	"area_blocks" : {
		"list":{
			"title": "List",
			"paths":[
				"/area_blocks","/area_blocks/area_list"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/area_blocks/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/area_blocks/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/area_blocks/update-status/:id/:status"
			]
		},
	},
	"cities" : {
		"list":{
			"title": "List",
			"paths":[
				"/cities"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/cities/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/cities/edit/:id"
			]
		}
	},
	"assignment_slabs" : {
		"list":{
			"title": "List",
			"paths":[
				"/assignment_slabs"
			]
		},
	},
	"category" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/category",'/:slug/pending_category',,"/restaurant_category","/pending_category"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/category/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/category/edit/:id",'/:slug/pending_category/edit/:id'
			]
		},
		"approve_reject":{
			"title": "In-Review / Approve / Disapprove",
			"paths":[
				'/pending_category/update_status', '/pending_category/update_multiple_status'
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/:slug/pending_category/update-status/:id/:status",
				"/:slug/category/update-status/:id/:status"
			]
		},
	},
	"team_breaks" : {
		"list":{
			"title": "List",
			"paths":[
				"/team_breaks"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/team_breaks/add"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/team_breaks/delete/:id"
			]
		},
		"approve_reject":{
			"title": "Approve/Reject",
			"paths":[
				"/team_breaks/approve_reject/:action/:id"
			]
		}
	},
	"cms" : {
		"list":{
			"title": "List",
			"paths":[
				"/cms"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/cms/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/cms/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/cms/delete/:id"
			]
		},
	},
	"restaurant_enquiries" : {
		"list":{
			"title": "List",
			"paths":[
				"/restaurant_enquiries"
			]
		},
		"approve_reject":{
			"title": "In-Review / Approve / Disapprove",
			"paths":[
				"/restaurant_enquiries/update-status/:id",
				"/restaurant_enquiries/update-multiple-status",
				"/restaurant_enquiries/reject_enquiry",
				"/restaurant_enquiries/approve/:id/:restaurant_id?"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/restaurant_enquiries/view/:id"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/restaurant_enquiries/add"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/restaurant_enquiries/delete-enquiry/:id"
			]
		},
		"update":{
			"title": "Update Restaurant Details",
			"paths":[
				"/restaurant_enquiries/update-restaurant/:restaurant_id"
			]
		},
		"download":{
			"title": "Download File",
			"paths":[
				"/restaurant_enquiries/download-file/:id"
			]
		}
	},
	"admin_modules" : {
		"list":{
			"title": "List",
			"paths":[
				"/admin_modules/:module_type", "/admin_modules/:module_type/change_order"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/admin_modules/:module_type/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/admin_modules/:module_type/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/admin_modules/:module_type/update-status/:id/:status"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/admin_modules/:module_type/delete/:id"
			]
		}
	},
	"admin_permissions" : {
		"list":{
			"title": "List",
			"paths":[
				"/admin_permissions",
				"/admin_permissions/get_role_modules"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/admin_permissions/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/admin_permissions/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/admin_permissions/update-status/:id/:status"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/admin_permissions/delete/:id"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/admin_permissions/view/:id"
			]
		},
		"assign_shift":{
			"title": "Assign And Shift Member",
			"paths":[
				"/admin_permissions/get_role_users_and_update/:team_head_status/:user_role_id/:user_id"
			]
		},
	},
	"admin_role" : {
		"list":{
			"title": "List",
			"paths":[
				"/admin_role/:user_type"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/admin_role/:user_type/add",
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/admin_role/:user_type/edit/:id",
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/admin_role/:user_type/delete/:id"
			]
		},
	},
	"ads_sliders": {
		"list": {
			"title": "List",
			"paths": [
				"/ads_sliders"
			]
		},
		"add": {
			"title": "Add",
			"paths": [
				"/ads_sliders/add",
			]
		},
		"edit": {
			"title": "Edit",
			"paths": [
				"/ads_sliders/edit/:id",
			]
		},
		"delete": {
			"title": "Delete",
			"paths": [
				"/ads_sliders/delete/:id"
			]
		},
	},
	"email_actions" : {
		"list":{
			"title": "List",
			"paths":[
				"/email_actions"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/email_actions/add",
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/email_actions/edit/:id",
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/email_actions/delete/:id"
			]
		},
	},
	"email_logs" : {
		"list":{
			"title": "List",
			"paths":[
				"/email_logs"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/email_logs/view",
			]
		}
	},
	"email_template" : {
		"list":{
			"title": "List",
			"paths":[
				"/email_template"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/email_template/edit/:id","/email_template/get_action_options",
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/email_template/add","/email_template/get_action_options",
			]
		},
	},
	"import_managers": {
		"list": {
			"title": "List",
			"paths": [
				"/import_managers"
			]
		},
		"active_deactive": {
			"title": "Active/Deactive",
			"paths": [
				"/import_managers/update-status/:id/:status"
			]
		},
		"download": {
			"title": "Download",
			"paths": [
				"/import_managers/download/:id"
			]
		},
	},
	"faq" : {
		"list":{
			"title": "List",
			"paths":[
				"/faqs"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/faqs/add",'/faqs/sub_category'
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/faqs/edit/:id",'/faqs/sub_category'
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/faqs/delete/:id"
			]
		},
		"update_status":{
			"title": "Active / Deactive",
			"paths":[
				"/faqs/update-status/:id/:status"
			]
		},
	},
	"master" : {
		"list":{
			"title": "List",
			"paths":[
				"/master/:type"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/master/:type/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/master/:type/edit/:id"
			]
		},
		"update_status":{
			"title": "Active / Deactive",
			"paths":[
				"/master/:type/change_status/:id/:status"
			]
		},
	},
	"site_settings" : {
		"site":{
			"title": "Site settings",
			"paths":[
				"/settings/prefix/Site"
			]
		}
	},
	"email_settings" : {
		"email":{
			"title": "Email settings",
			"paths":[
				"/settings/prefix/Email"
			]
		}
	},
	"rewards_and_referrals_settings" : {
		"rewards":{
			"title": "Rewards and Referrals settings",
			"paths":[
				"/settings/prefix/Rewards_and_referrals"
			]
		}
	},
	"sms_settings" : {
		"sms":{
			"title": "SMS Template",
			"paths":[
				"/sms_templates"
			]
		}
	},
	"payment_settings" : {
		"payment":{
			"title": "Payment settings",
			"paths":[
				"/settings/prefix/Payment"
			]
		}
	},
	"refund_permission_settings" : {
		"payment":{
			"title": "Refund permission settings",
			"paths":[
				"/settings/prefix/Refund_Permission"
			]
		}
	},
	"points_system_settings" : {
		"points":{
			"title": "Points System settings",
			"paths":[
				"/settings/prefix/Points_system"
			]
		}
	},
	"order_assignment_settings" : {
		"site":{
			"title": "Order Assignment settings",
			"paths":[
				"/settings/prefix/Order_Assignment"
			]
		}
	},
	"system_settings" : {
		"site":{
			"title": "System settings",
			"paths":[
				"/settings/prefix/System_images"
			]
		}
	},
	"compensation_permission_settings" : {
		"site":{
			"title": "Compensation Permission settings",
			"paths":[
				"/settings/prefix/Compensation_Permission"
			]
		}
	},
	"app_settings" : {
		"sms":{
			"title": "App settings",
			"paths":[
				"/settings/prefix/App"
			]
		}
	},
	"notification" : {
		"list":{
			"title": "Notification",
			"paths":[
				"/notifications", "/notifications/get_header_notifications", "/notifications/get_header_notifications_counter"
			]
		},
	},
	"notification_types" : {
		"list":{
			"title": "List",
			"paths":[
				"/notification_types"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/notification_types/edit/:id"
			]
		},
	},
	"sms_templates" : {
		"list":{
			"title": "List",
			"paths":[
				"/sms_templates"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/sms_templates/edit/:id"
			]
		},
	},
	"branches" : {
		"list":{
			"title": "List",
			"paths":[
				"/restaurants/:slug?/:type?/:id?",
				"/:slug/branches",

				/** Pending branch  */
				"/:slug/pending_branches",
				"/restaurant_pending_branches",
			]
		},
		"add":{
			"title": "Add Branch",
			"paths":[
				"/:slug/branches/add",
				"/:slug/pending_branches/publish/:id",
			]
		},
		"branch_details":{
			"title": "Branch Details",
			"paths":[
				"/:slug/branches/view/:id",
				"/:slug/branches/branch_detail/:id",
				"/:slug/branches/edit/:id",
				"/:slug/branches/get_area_list",
				"/:slug/branches/get_block_list",

				/** Pending branch  */
				"/:slug/pending_branches/view/:id",
				"/:slug/pending_branches/branch_detail/:id",
				"/:slug/pending_branches/update/:id",
			]
		},
		"branch_area":{
			"title": "Covered Areas",
			"paths":[
				"/:slug/branches/branch_areas/:id",
				"/:slug/branches/add_branch_areas/:id",
				"/:slug/branches/get_branch_area_settings/:id",
				"/:slug/branches/update_branch_area_status/:id",
				"/:slug/branches/save_branch_area_settings/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_areas/:id",
				"/:slug/pending_branches/add_branch_areas/:id",
				"/:slug/pending_branches/get_branch_area_settings/:id",
				"/:slug/pending_branches/update_branch_area_status/:id",
				"/:slug/pending_branches/save_branch_area_settings/:id",
			]
		},
		"branch_attribute":{
			"title": "Branch Attributes",
			"paths":[
				"/:slug/branches/branch_attributes/:id",
				"/:slug/branches/save_branch_attributes/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_attributes/:id",
				"/:slug/pending_branches/save_branch_attributes/:id",
			]
		},
		"branch_phones":{
			"title": "Branch Phones",
			"paths":[
				"/:slug/branches/branch_phones/:id",
				"/:slug/branches/add_phone_number/:id",
				"/:slug/branches/update_phone_number/:id/:phone_number_id",
				"/:slug/branches/delete_phone_number/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_phones/:id",
				"/:slug/pending_branches/add_phone_number/:id",
				"/:slug/pending_branches/update_phone_number/:id/:phone_number_id",
				"/:slug/pending_branches/delete_phone_number/:id",
			]
		},
		"branch_payment_methods":{
			"title": "Branch Payment methods",
			"paths":[
				"/:slug/branches/branch_payments/:id",
				"/:slug/branches/save_payment_methods/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_payments/:id",
				"/:slug/pending_branches/save_payment_methods/:id",
			]
		},
		"branch_calendar":{
			"title": "Branch Calendar",
			"paths":[
				"/:slug/branches/branch_calendars/:id",
				"/:slug/branches/add_branch_calendar/:id",
				"/:slug/branches/delete_calendar/:id",
				"/:slug/branches/get_calendar_child_details/:id",

				/** Pending branch  */
				"/:slug/pending_branches/branch_calendars/:id",
				"/:slug/pending_branches/add_branch_calendar/:id",
				"/:slug/pending_branches/delete_calendar/:id",
				"/:slug/pending_branches/get_calendar_child_details/:id",
			]
		},
		"update_status":{
			"title": "In-Review / Approve / Disapprove",
			"paths":[
				"/:slug/pending_branches/review/:id",
				"/:slug/pending_branches/approve/:id",
				"/:slug/pending_branches/reject",
				"/restaurant_pending_branches/update_branch_status",
			]
		},
		"active_deactive_open_close":{
			"title": "Active / Deactive / Open / Busy",
			"paths":[
				"/:slug/branches/update-branch-status"
			]
		},
		"cuisine_priorities":{
			"title": "Cuisine Priorities",
			"paths":[
				"/cuisine_priorities/:restaurant_id/:branch_id",
				"/cuisine_priorities/:restaurant_id/:branch_id/get_approve_list",
				"/cuisine_priorities/:restaurant_id/:branch_id/select_cuisine_priority"
			]
		},
	},
	"shift_setup" : {
		"list":{
			"title": "List",
			"paths":[
				"/shift_setup"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/shift_setup/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/shift_setup/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/shift_setup/delete/:id"
			]
		},
		"assign_shift":{
			"title": "Assign Shift",
			"paths":[
				"/shift_setup/assign_shift/:shift_id/:id?",
				"/team_schedule/assign_shift"
			]
		},
		"team_schedule":{
			"title": "Team Schedule",
			"paths":[
				"/team_schedule"
			]
		},
		"user_schedule":{
			"title": "User Schedule",
			"paths":[
				"/shift_setup/user_schedule"
			]
		},
		"export_schedule":{
			"title": "Export Schedule",
			"paths":[
				"/shift_setup/export_schedule/:from_date/:to_date"
			]
		},
		"user_schedule":{
			"title": "User Schedule",
			"paths":[
				"/shift_setup/user_schedule"
			]
		}
	},
	"driver_shifts" : {
		"list":{
			"title": "List",
			"paths":[
				"/driver_shifts","/driver_shifts/area_list"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/driver_shifts/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/driver_shifts/edit/:id"
			]
		},
		"export_schedule":{
			"title": "Export Schedule",
			"paths":[
				"/driver_shifts/export_schedule/:from_date/:to_date/:parent_id?"
			]
		},
		"user_schedule":{
			"title": "User Schedule",
			"paths":[
				"/driver_shifts/user_schedule/:parent_id?"
			]
		},
	},
	"orders" : {
		"list":{
			"title": "List",
			"paths":[
				"/orders",
				"/orders/get_order_rules",
				"/orders/branch_list",
				"/user_management/load_map"
			]
		},
		"accept_reject":{
			"title": "Accept/Reject",
			"paths":[
				"/orders/accept_status/:_id",
				"/orders/reject_order_status",
			]
		},
		"change_status":{
			"title": "Change Status",
			"paths":[
				"/orders/change_status/:_id",
				"/orders/order_revert/:order_id",
				"/orders/submit_order/:order_id",
				"/orders/resend_order/:order_id"
			]
		},
		"cancel_order":{
			"title": "Cancel Order",
			"paths":[
				"/orders/change_status/:_id"
			]
		},
		"reschedule_order":{
			"title": "Reschedule Order",
			"paths":[
				"/orders/reschedule/:_id"
			]
		},
		"change_address":{
			"title": "Change Address",
			"paths":[
				"/orders/change_address/:order_id",
				"/orders/add_address/:order_id",
				"/orders/edit_address/:order_id/:id",
				"/orders/get_block_list",
				"/orders/get_area_list"
			]
		},
		"modify_orders":{
			"title": "Modify Order",
			"paths":[
				"/modify_orders/change_quantity/:order_id/:item_id/:extra_param?",
				"/modify_orders/add_items/:order_id",
				"/modify_orders/get_choice_item",
				"/modify_orders/update_new_items",
				"/modify_orders/delete_item_cart",
				"/modify_orders/add_multiple_item_cart/:order_id",
				"/modify_orders/my_cart/:order_id",
				"/modify_orders/apply_coupon",
				"/modify_orders/place_order",
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/orders/export_data/:export_count/:export_type"
			]
		},
		"refund_amount":{
			"title": "Refund Amount",
			"paths":[
				"/orders/refund_amount/:id"
			]
		},
		"confirm_status":{
			"title": "Confirm Order Status",
			"paths":[
				"/orders/confirm_order_status/:order_id"
			]
		},
	},
	"order_detail" : {
		"view":{
			"title": "Order Detail",
			"paths":[
				"/orders/view/:id/:type?",
				"/orders/get_location",
				"/orders/list_items/:order_id",
				"/orders/status_logs/:order_id",
				"/user_management/load_map"
			]
		},
		"financial_info":{
			"title": "Financial Info",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"delivery_info":{
			"title": "Delivery Info",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"addresses":{
			"title": "Addresses",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"client_info":{
			"title": "Client Info",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"offer_dtail":{
			"title": "Offer Detail",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"order_items":{
			"title": "Order Item",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"order_status":{
			"title": "Order Status",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
		"location_map":{
			"title": "Location Map",
			"paths":[
				"/orders/get_location",
			]
		},
		"voc_client":{
			"title": "Voc Client",
			"paths":[
				"/voc_management/order_voc_list/:order_id/:voc_type",
			]
		},
		"add_voc_client": {
			"title": "Add Client Order Voc",
			"paths":[
				"/voc_management/add_order_voc/:order_id/:voc_type?",
				"/voc_management/get_question_list"
			]
		},
		"voc_captain":{
			"title": "Voc Captain",
			"paths":[
				"/voc_management/order_voc_list/:order_id/:voc_type",
			]
		},
		"add_voc_captain": {
			"title": "Add Captain Order Voc",
			"paths":[
				"/voc_management/add_order_voc/:order_id/:voc_type?",
				"/voc_management/get_question_list"
			]
		},
		"ticket_list":{
			"title": "Ticket List",
			"paths":[
				"/tickets/order_ticket_list/:order_id",
			]
		},
		"refund_and_compensation_list":{
			"title": "Refund/Compensation List",
			"paths":[
				"/orders/refund_details/:order_id",
			]
		},
		"restaurant_details":{
			"title": "Restaurant Details",
			"paths":[
				"/orders/view/:id/:type?",
			]
		},
	},
	"fleet_area_assignment" : {
		"list":{
			"title": "List",
			"paths":[
				"/fleet_area_assignment","/fleet_area_assignment/area_list"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/fleet_area_assignment/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/fleet_area_assignment/edit/:id"
			]
		},
	},
	"leave_master" : {
		"leave_master":{
			"title": "Leave Master",
			"paths":[
				"/leave_management/leave_master"
			]
		},
	},
	"vacation_request" : {
		"list":{
			"title": "List",
			"paths":[
				"/leave_management/vacation_request","/leave_management/vacation_request/export_data/:export_count/:export_type",
			]
		},
		"add_weekly_off":{
			"title": "Add Weekly Off",
			"paths":[
				"/leave_management/vacation_request/add_weekly_off"
			]
		},
		"edit_weekly_off":{
			"title": "Edit Weekly Off",
			"paths":[
				"/leave_management/vacation_request/edit_weekly_off/:id"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/leave_management/vacation_request/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/leave_management/vacation_request/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/leave_management/vacation_request/delete/:id"
			]
		},
		"view":{
			"title": "View Leave Balance",
			"paths":[
				"/leave_management/vacation_request/view_leave_balance/:id"
			]
		},
		"export":{
			"title": "Export Data",
			"paths":[
				"/leave_management/vacation_request/export_data/:export_count/:export_type"
			]
		},
		"update_request_status":{
			"title": "In-Review / Approve / Disapprove",
			"paths":[
				"/leave_management/vacation_request/update_request_status",
			]
		},
	},
	"driver_vacation_request" : {
		"list":{
			"title": "List",
			"paths":[
				"/driver_leave_management/driver_vacation_request","/driver_leave_management/driver_vacation_request/export_data/:export_count/:export_type"
			]
		},
		"add_weekly_off":{
			"title": "Add Weekly Off",
			"paths":[
				"/driver_leave_management/driver_vacation_request/add_weekly_off"
			]
		},
		"edit_weekly_off":{
			"title": "Edit Weekly Off",
			"paths":[
				"/driver_leave_management/driver_vacation_request/edit_weekly_off/:id"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/driver_leave_management/driver_vacation_request/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/driver_leave_management/driver_vacation_request/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/driver_leave_management/driver_vacation_request/delete/:id"
			]
		},
		"view":{
			"title": "View Leave Balance",
			"paths":[
				"/driver_leave_management/driver_vacation_request/view_leave_balance/:id"
			]
		},
		"export":{
			"title": "Export Data",
			"paths":[
				"/driver_leave_management/driver_vacation_request/export_data/:export_count/:export_type"
			]
		},
		"update_request_status": {
			"title": "In-Review / Approve / Disapprove",
			"paths": [
				"/driver_leave_management/update_request_status",
			]
		},
	},
	"task_assignment" : {
		"list":{
			"title": "List",
			"paths":[
				"/task_assignment"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/task_assignment/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/task_assignment/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/task_assignment/delete/:id"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/task_assignment/view/:id"
			]
		},
	},
	"all_tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets/all_tickets","/tickets/get_category","/tickets/user_list"
			]
		}
	},
	"my_tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets/my_tickets","/tickets/get_category","/tickets/user_list"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/tickets/add",,"/tickets/get_category","/tickets/order_ticket_list/add/:order_id","/tickets/customer_ticket_list/add/:user_id"
			]
		}
	},
	"incoming_tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets/incoming_tickets","/tickets/get_category","/tickets/user_list"
			]
		}
	},
	"close_tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets/close_tickets","/tickets/get_category","/tickets/user_list"
			]
		}
	},
	"reopen_tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets/reopen_tickets","/tickets/get_category","/tickets/user_list"
			]
		}
	},
	"qa_comment_tickets" : {
		"list":{
			"title": "List",
			"paths":[
				"/tickets/qa_comment_tickets","/tickets/get_category","/tickets/user_list"
			]
		}
	},
	"ticket_details" : {
		"view":{
			"title": "View",
			"paths":[
				"/tickets/view/:id",
				"/tickets/add_comment",
				"/tickets/add_review",
				"/tickets/reassign",
				"/tickets/close_ticket/:ticket_id",
				"/tickets/reopen",
			]
		},
		"ticket_checkin":{
			"title": "Check In",
			"paths":[
				"/tickets/update-status/:id"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/tickets/:ticket_type/export_data/:export_count/:export_type"
			]
		},
	},
	"ticket_update" : {
		"edit":{
			"title": "Edit",
			"paths":[
				"/tickets/edit/:id"
			]
		},
	},
	"survey_management" : {
		"list":{
			"title": "List",
			"paths":[
				"/survey_management"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/survey_management/add",
				"/survey_management/delete/:id/:option_id?"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/survey_management/edit/:id"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/survey_management/view/:survey_id/:user_id"
			]
		},
		"view_graph":{
			"title": "View Graph",
			"paths":[
				"/survey_management/view_graph/:id"
			]
		},
		"make_live":{
			"title": "Make Live",
			"paths":[
				"/survey_management/make_live/:id/:status"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/survey_management/delete/:id"
			]
		},
		"view_history":{
			"title": "View History",
			"paths":[
				"/survey_management/view_history/:id"
			]
		},
	},
	"driver_management" : {
		"list":{
			"title": "List",
			"paths":[
				"/user_management/list_driver"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/user_management/add_driver",
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/user_management/edit_driver/:id"
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/user_management/view_driver/:id",
				"/user_management/driver_locations/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/user_management/delete_driver/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/user_management/update-driver-status/:id/:status"
			]
		},
		"manage_vehicle":{
			"title": "Manage Vehicle",
			"paths":[
				"/user_management/manage_vehicle/:driver_id",
				"/user_management/manage_vehicle/:driver_id/add_vehicle",
				"/user_management/manage_vehicle/:driver_id/edit_vehicle/:id",
				"/user_management/manage_vehicle/:driver_id/assign_vehicle",
				"/user_management/manage_vehicle/:driver_id/export_data/:export_count/:export_type"
			]
		},
	},
	"customer_management" : {
		"list":{
			"title": "List",
			"paths":[
				"/user_management/list_customer"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/user_management/add_customer",
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/user_management/edit_customer/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/user_management/delete_customer/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/user_management/update-customer-status/:id/:status"
			]
		},
		"assign_category":{
			"title": "Assign Category",
			"paths":[
				"/user_management/assign_category/:id"
			]
		},
		"blacklist":{
			"title": "Blacklist",
			"paths":[
				"/user_management/update-customer-black-list/:id/:status"
			]
		},
	},
	"user_detail" : {
		"customer_detail":{
			"title": "Customer Detail",
			"paths":[
				"/user_management/view_customer/:id/:type?",
				"/user_management/customer_details/:id",
			]
		},
		"order_list":{
			"title": "Order List",
			"paths":[
				"/user_management/customer_order_list/:id",
			]
		},
		"address_list":{
			"title": "Address List",
			"paths":[
				"/user_management/customer_address_list/:id",
			]
		},
		"package_list":{
			"title": "Package List",
			"paths":[
				"/user_management/customer_package_list/:id",
			]
		},
		"compensation_list":{
			"title": "Compensation List",
			"paths":[
				"/user_management/refund_detail/:id",
			]
		},
		"account_list":{
			"title": "Account List",
			"paths":[
				"/user_management/customer_account_list/:id",
			]
		},
		"wallet_details":{
			"title": "Wallet Details",
			"paths":[
				"/user_management/customer_wallet_details/:id",
			]
		},
		"wallet_transaction_list":{
			"title": "Wallet Transaction List",
			"paths":[
				"/user_management/customer_wallet_transaction_list/:id",
			]
		},
		"verification_list":{
			"title": "Verification List",
			"paths":[
				"/user_management/customer_verification_list/:id",
			]
		},
		"ticket_list":{
			"title": "Ticket List",
			"paths":[
				"/tickets/customer_ticket_list/:user_id",
			]
		},
		"voc_list":{
			"title": "VOC List",
			"paths":[
				"/voc_management/customer_voc_list/:user_id",
			]
		},
		"payment_transaction_list":{
			"title": "Payment Transaction List",
			"paths":[
				"/payment_transaction/customer_payment_transaction_list/:user_id",
			]
		},
		"reward_points_list":{
			"title": "Reward Points List",
			"paths":[
				"/user_management/customer_reward_points_list/:id/:type",
			]
		},
		"view_address":{
			"title": "View Address",
			"paths":[
				"/user_management/view_address/:id",
			]
		},
		"add_wallet_amount":{
			"title": "Add Wallet Amount",
			"paths":[
				"/user_management/add_wallet_amount/:id",
			]
		},
	},
	"ticket_category" : {
		"list":{
			"title": "List",
			"paths":[
				"/category/:category_id?"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/category/add/:parent_category_id?"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/category/edit/:id/:parent_category_id?"
			]
		}
	},
	"merchant_upload" : {
		"list":{
			"title": "List",
			"paths":[
				"/merchant_upload",
				"/merchant_upload/add_branch",
				"/merchant_upload/add_branch_areas",
				"/merchant_upload/add_category",
				"/merchant_upload/add_main_category",
				"/merchant_upload/add_item",
				"/merchant_upload/add_item_choice_group",
				"/merchant_upload/add_item_extra_items",
				"/merchant_upload/add_menu",
				"/merchant_upload/add_restaurant",
				"/merchant_upload/export_data/:export_id",
			]
		}
	},
	"overtime_request" : {
		"list":{
			"title": "List",
			"paths":[
				"/overtime_request"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/overtime_request/add"
			]
		}
	},
	"overtime_captain_request" : {
		"list":{
			"title": "List",
			"paths":[
				"/overtime_captain_request"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/overtime_captain_request/add"
			]
		}
	},
	"super_packages" : {
		"list":{
			"title": "List",
			"paths":[
				"/super_packages"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/super_packages/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/super_packages/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/super_packages/delete/:id"
			]
		},
	},
	"slider_management" : {
		"list":{
			"title": "List",
			"paths":[
				"/slider_management/:type"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/slider_management/:type/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/slider_management/:type/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/slider_management/:type/delete/:id"
			]
		},
		"update_status":{
			"title": "Update Status",
			"paths":[
				"/slider_management/:type/update_status/:id/:status"
			]
		},
	},
	"banner_management": {
		"list": {
			"title": "List",
			"paths": [
				"/banner_management"
			]
		},
		"add": {
			"title": "Add",
			"paths": [
				"/banner_management/add"
			]
		},
		"edit": {
			"title": "Edit",
			"paths": [
				"/banner_management/edit/:id"
			]
		},
		"delete": {
			"title": "Delete",
			"paths": [
				"/banner_management/delete/:id"
			]
		},
		"update_status": {
			"title": "Update Status",
			"paths": [
				"/banner_management/update_status/:id/:status"
			]
		},
	},
	"cuisines" : {
		"list":{
			"title": "List",
			"paths":[
				"/cuisines"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/cuisines/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/cuisines/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/cuisines/update-status/:id/:status"
			]
		},
		"select_cuisine_priority":{
			"title": "Select Cuisine Priority",
			"paths":[
				"/cuisines/select_cuisine_priority"
			]
		},
	},
	"attributes" : {
		"list":{
			"title": "List",
			"paths":[
				"/attributes"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/attributes/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/attributes/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/attributes/delete/:id"
			]
		},
		"change_order":{
			"title": "Change Order",
			"paths":[
				"/attributes/change_order"
			]
		},
	},
	"item" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/item","/:slug/pending_item","/restaurant_item","/pending_item"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/item/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/item/edit/:id","/:slug/pending_item/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active / Deactive",
			"paths":[
				"/:slug/item/update-status"
			]
		},
		"admin_action":{
			"title": "In-Review / Approve / Disapprove",
			"paths":[
				'/pending_item/item_action',
			]
		},
		"recommended_item":{
			"title": "Recommended Item",
			"paths":[
				"/:slug/item/recommended_item/:item_id"
			]
		},
		"overriding":{
			"title": "Overriding",
			"paths":[
				"/:slug/item/overriding/:item"
			]
		},
		"branches_inactive":{
			"title": "Inactive Branches",
			"paths":[
				"/:slug/item/branches_inactive/:item"
			]
		},
		"item_order":{
			"title": "Item Order",
			"paths":[
				"/:slug/item/item_order/:item"
			]
		},
		"clone":{
			"title": "Clone",
			"paths":[
				"/:slug/item/clone/:item"
			]
		},
		"rollback":{
			"title": "Rollback",
			"paths":[
				"/:slug/item/rollback/:item"
			]
		},
		"choice_group":{
			"title": "Choice Group",
			"paths":[
				"/:slug/choice_group/:item_id", "/:slug/pending_choice_group/:item_id",
				"/:slug/choice_group/:item_id/add", "/:slug/pending_choice_group/:item_id/add",
				"/:slug/choice_group/:item_id/edit/:id","/:slug/pending_choice_group/:item_id/edit/:id",
				"/:slug/choice_group/:item_id/delete/:id","/:slug/pending_choice_group/:item_id/delete/:id",
				"/:slug/choice_group/:item_id/add_extra/:id","/:slug/pending_choice_group/:item_id/add_extra/:id",
				"/:slug/choice_group/:item_id/clone/:id",
				"/:slug/choice_group/:item_id/get_item_list",
			]
		},
		"extra_items":{
			"title": "Extra Items",
			"paths":[
				"/:slug/extra_items/:item_id","/:slug/pending_extra_items/:item_id",
				"/:slug/extra_items/:item_id/add","/:slug/pending_extra_items/:item_id/add",
				"/:slug/extra_items/:item_id/edit/:id","/:slug/pending_extra_items/:item_id/edit/:id",
				"/:slug/extra_items/:item_id/delete/:id",
				"/:slug/extra_items/:item_id/update-extra-item-status",
				"/:slug/extra_items/:item_id/clone_extra_item/:id",
				"/:slug/extra_items/:item_id/get_item_list",
				"/:slug/extra_items/:item_id/extra_item_order/:id",
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/:slug/item/view/:id","/:slug/pending_item/view/:id",
			]
		},
		"send_for_approval":{
			"title": "Send For Approval",
			"paths":[
				"/:slug/pending_item/send_for_approval/:id",
			]
		},
		"upselling_item":{
			"title": "Upselling Item",
			"paths":[
				"/:slug/item/upselling_item/:item_id"
			]
		},
	},
	"size_category" : {
		"list":{
			"title": "List",
			"paths":[
				"/:slug/size_category"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/:slug/size_category/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/:slug/size_category/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/:slug/size_category/delete/:id"
			]
		},
	},
	"restaurant_cuisines" : {
		"list":{
			"title": "List",
			"paths":[
				"/restaurant_cuisine/:slug?","/restaurant_cuisine/:slug?/get-cuisine-list"
			]
		},
		"select_cuisines":{
			"title": "Select Cuisines",
			"paths":[
				"/restaurant_cuisine/:slug?/:id/select_cuisines"
			]
		}
	},
	"driver_breaks" : {
		"list":{
			"title": "List",
			"paths":[
				"/driver_breaks/:break_status?"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/driver_breaks/delete/:id/:driver_id"
			]
		},
		"approve_reject":{
			"title": "Approve / Disapprove",
			"paths":[
				"/driver_breaks/reject/:action/:id/:driver_id",
				"/driver_breaks/approve/:action/:id/:driver_id",
				"/driver_breaks/cancel/:id/:driver_id"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/driver_breaks/add"
			]
		},
		"end":{
			"title": "End",
			"paths":[
				"/driver_breaks/end_break/:break_id"
			]
		}
	},
	"manage_vehicles" : {
		"list":{
			"title": "List",
			"paths":[
				"/manage_vehicles"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/manage_vehicles/export_data/:export_count/:export_type"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/manage_vehicles/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/manage_vehicles/edit/:id"
			]
		},
	},
	"driver_in_out_shifts" : {
		"list":{
			"title": "List",
			"paths":[
				"/driver_in_out_shifts",
				"/driver_in_out_shifts/update_kilometer"
			]
		},
	},
	"driver_excuses" : {
		"list":{
			"title": "List",
			"paths":[
				"/driver_excuses"
			]
		},
		"approve_reject":{
			"title": "Approve / Disapprove",
			"paths":[
				"/driver_excuses/approve/:id/:driver_id",
				"/driver_excuses/reject/:action/:id/:driver_id",
				"/driver_excuses/cancel/:id/:driver_id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/driver_excuses/delete/:id/:driver_id"
			]
		}
	},
	"attribute_management" : {
		"list":{
			"title": "List",
			"paths":[
				"/attribute_management/:type",
				"/attribute_management/:type/change_order"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/attribute_management/:type/add"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/attribute_management/:type/edit/:id"
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/attribute_management/:type/delete/:id"
			]
		},
	},
	"captain_tracking" : {
		"list":{
			"title": "List",
			"paths":[
				"/captain_tracking",
				"/captain_tracking/get_captain_rules",
				"/captain_tracking/get_captain_location",
				"/captain_tracking/get_captain_deliveries",
				"/captain_tracking/update-force-active/:id/:status",
				"/captain_tracking/suspend-status/:id/:status",
				"/captain_tracking/assign_captain_list/:order_id",
				"/captain_tracking/order_reassign_to_captain",
				"/order_tracking/get_captain_list",
				"/order_tracking/get_driver_location",
			]
		},
		"voc_list":{
			"title": "VOC List",
			"paths":[
				"/captain_tracking/get_captain_voc_list/:order_id"
			]
		},
		"ticket_list":{
			"title": "Ticket List",
			"paths":[
				"/captain_tracking/get_captain_ticket_list/:order_id"
			]
		},
		"captain_stats":{
			"title": "Captain Stats",
			"paths":[
				"/captain_tracking/get_captain_stats/:id"
			]
		},
		"add_ticket":{
			"title": "Add Ticket / Comment",
			"paths":[
				"/tickets/order_ticket_list/add/:order_id",
				"/captain_tracking/tickets/add_comment/:ticket_id",
				"/tickets/add_comment",
			]
		},
		"add_voc":{
			"title": "Add VOC",
			"paths":[
				"/voc_management/add_order_voc/:order_id/:voc_type?",
				"/voc_management/get_question_list"
			]
		},
	},
	"offer" : {
		"list":{
			"title": "List",
			"paths":[
				"/offer_management"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/offer_management/add",
				"/offer_management/branch_list",
				"/offer_management/category_list",
				"/offer_management/cuisine_list",
				"/offer_management/item_list",
				"/offer_management/restaurant_list",
				"/offer_management/get_user_list",
				"/offer_management/get_users"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/offer_management/edit/:id",
				"/offer_management/branch_list",
				"/offer_management/category_list",
				"/offer_management/cuisine_list",
				"/offer_management/item_list",
				"/offer_management/restaurant_list",
				"/offer_management/get_user_list",
				"/offer_management/get_users"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/offer_management/update-status/:id/:status"
			]
		},
	},
	"add_in_wallet" : {
		"list":{
			"title": "List",
			"paths":[
				"/add_in_wallet"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/add_in_wallet/add"
			]
		}
	},
	"voc_management" : {
		"list":{
			"title": "List",
			"paths":[
				"/voc_management"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/voc_management/add",
				"/voc_management/delete/:id/:option_id?"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/voc_management/edit/:id"
			]
		},
		"active_deactive":{
			"title": "Active/Deactive",
			"paths":[
				"/voc_management/update-status/:id/:status"
			]
		},
	},
	"order_tracking" : {
		"list":{
			"title": "List",
			"paths":[
				"/order_tracking",
				"/order_tracking/get_order_location",
				"/order_tracking/get_order_data",
				"/orders/branch_list",
				"/order_tracking/get_floor_status_list",
				"/user_management/load_map"

			]
		},
		"accept_reject":{
			"title": "Accept/Reject",
			"paths":[
				"/orders/accept_status/:_id",
				"/orders/reject_order_status",
			]
		},
		"change_status":{
			"title": "Change Status",
			"paths":[
				"/orders/change_status/:_id",
				"/orders/requeue/:_id"
			]
		},
		"change_address":{
			"title": "Change Address",
			"paths":[
				"/orders/change_address/:order_id",
				"/orders/add_address/:order_id",
				"/orders/edit_address/:order_id/:id",
				"/orders/get_block_list",
				"/orders/get_area_list"
			]
		},
		"cancel_order":{
			"title": "Cancel Order",
			"paths":[
				"/orders/change_status/:_id"
			]
		},
		"assign":{
			"title": "Assign Driver",
			"paths":[
				"/order_tracking/assign_captain_list/:order_id",
				"/order_tracking/get_captain_list",
				"/order_tracking/get_floor_status_list",
				"/order_tracking/order_assign_to_captain/:order_id/:captain_id/:distance_in_minutes",
				"/order_tracking/get_driver_location",
			]
		},
		"reschedule_order":{
			"title": "Reschedule Order",
			"paths":[
				"/orders/reschedule/:_id"
			]
		},
		"undo_assign":{
			"title": "Undo Assigned",
			"paths":[
				"/order_tracking/order_undo_assign/:order_id"
			]
		},
		"confirm_status":{
			"title": "Confirm Order Status",
			"paths":[
				"/order_tracking/confirm_order_status/:order_id"
			]
		},
	},
	"branch_offer_link" : {
		"list":{
			"title": "List",
			"paths":[
				"/branch_offer_link", "/branch_offer_link/restaurant_branch_list"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/branch_offer_link/add",
			]
		},
	},
	"payment_transaction" : {
		"list":{
			"title": "List",
			"paths":[
				"/payment_transaction",
			]
		},
	},
	"screen_visit_logs" : {
		"list":{
			"title": "List",
			"paths":[
				"/screen_visit_logs"
			]
		},
	},
	"customer_order_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/customer_order",
				"/report/customer_order/branch_list"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/customer_order/export_data"
			]
		},
	},
	"payment_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/payment_report"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/payment_report/export_data"
			]
		}
	},
	"public_holidays" : {
		"list":{
			"title": "List",
			"paths":[
				"/public_holidays"
			]
		}
	},
	"sales_reports" : {
		"list":{
			"title": "List",
			"paths":[
				"/sales_reports",
				"/sales_reports/total_order_per_restaurant",
				"/sales_reports/redeem_every_offer_report",
				"/sales_reports/cancellation_report",
				"/sales_reports/rejected_report",
				"/sales_reports/total_order_per_rest_with_payment_method",
				"/sales_reports/total_order_per_rest_with_offers",
				"/sales_reports/total_order_per_rest_without_offers",
			]
		}
	},
	"unsettled_payments" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/unsettled_payment",
				"/report/restaurant_branch_dropdown",
				"/report/branch_list"
			]
		},
		"order_details":{
			"title": "Order Details",
			"paths":[
				"/report/unsettled_payment/order_details/:restaurant_id"
			]
		},
		"payment_history":{
			"title": "Payment History",
			"paths":[
				"/report/unsettled_payment/payment_history/:restaurant_id"
			]
		},
		"pay":{
			"title": "Pay",
			"paths":[
				"/report/unsettled_payment/pay/:restaurant_id"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/unsettled_export_data/export_data"
			]
		},
		"export_order_logs":{
			"title": "Export Order Logs",
			"paths":[
				"/report/export_data"
			]
		},
	},
	"settled_payments" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/settled_payments",
				"/report/restaurant_branch_dropdown"
			]
		},
		"order_details":{
			"title": "Order Details",
			"paths":[
				"/report/settled_payment/order_details/:restaurant_id"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/settled_export_data/export_data"
			]
		},
		"export_order_logs":{
			"title": "Export Order Logs",
			"paths":[
				"/report/export_data"
			]
		},
	},
	"restaurant_orders_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/restaurant_orders_report",
				"/report/append_restaurant_orders_report/:from_date/:to_date/:restaurant_id/:branch_id?",
				"/report/customer_order/branch_list"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/restaurant_orders_report/export_data/:from_date/:to_date/:restaurant_id?/:branch_id?"
			]
		},
	},
	"manual_wallet_refund_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/manual_wallet_refund_report",
				"/report/customer_order/branch_list",
				"/report/append_manual_wallet_refund_report/:from_date/:to_date/:restaurant_id/:branch_id?"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/manual_wallet_refund_report/export_data/:from_date/:to_date/:restaurant_id?/:branch_id?"
			]
		},
	},
	"order_count_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/order_count_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/order_count_report/export_data"
			]
		},
	},
	"order_value_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/order_value_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/order_value_report/export_data"
			]
		},
	},
	"captain_wise_order_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/captain_wise_order_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/captain_wise_order_report/export_data"
			]
		},
	},
	"orders_per_governorate" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/orders_per_governorate",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/orders_per_governorate/export_data"
			]
		},
	},
	"average_daily_number_of_orders" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/average_daily_number_of_orders",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/average_daily_number_of_orders/export_data"
			]
		},
	},
	"top_selling_items" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/top_selling_items",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/top_selling_items/export_data"
			]
		},
	},
	"most_selling_items" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/most_selling_items",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/most_selling_items/export_data"
			]
		},
	},
	"quality_category" : {
		"list":{
			"title": "List",
			"paths":[
				"/quality_category/:category_id?",
				"/report/restaurant_branch_dropdown"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/quality_category/add/:parent_category_id?"
			]
		},
		"edit":{
			"title": "Edit",
			"paths":[
				"/quality_category/edit/:id/:parent_category_id?"
			]
		}
	},
	"quality_monitor_form" : {
		"list":{
			"title": "List",
			"paths":[
				"/avaya_reports/quality_monitor_form",
				"/avaya_reports/get_user_list",
				"/avaya_reports/monthly_performance",
				"/avaya_reports/view_monitor_form",

			]
		},
	},
	"monthly_performance" : {
		"list":{
			"title": "List",
			"paths":[
				"/avaya_reports/monthly_performance"
			]
		},
	},
	"number_of_customers" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/number_of_customers",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/number_of_customers/export_data"
			]
		},
	},
	"favourite_restaurant_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/favourite_restaurant_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/favourite_restaurant_report/export_data"
			]
		},
	},
	"favourite_cuisine_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/favourite_cuisine_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/favourite_cuisine_report/export_data"
			]
		},
	},
	"order_payment_cancel_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/order_payment_cancel",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/order_payment_cancel/export_data"
			]
		},
	},
	"push_notifications" : {
		"list":{
			"title": "List",
			"paths":[
				"/push_notifications",
				"/report/restaurant_branch_dropdown"
			]
		},
		"add":{
			"title": "Add",
			"paths":[
				"/push_notifications/add",
			]
		},
		"view":{
			"title": "View",
			"paths":[
				"/push_notifications/view/:id",
			]
		},
		"delete":{
			"title": "Delete",
			"paths":[
				"/push_notifications/delete/:id",
			]
		},
		"get_user_list":{
			"title": "User List",
			"paths":[
				"/push_notifications/get_user_dropdown"
			]
		},
	},
	"captain_assigned" : {
		"list":{
			"title": "List",
			"paths":[
				"/captain_assigned",
				"/report/restaurant_branch_dropdown"
			]
		}
	},
	"kfg_areas" : {
		"list":{
			"title": "List",
			"paths":[
				"/kfg_areas",
				"/report/restaurant_branch_dropdown"
			]
		},
		"assign_area":{
			"title": "Assign Area",
			"paths":[
				"/kfg_areas/assign_area/:id"
			]
		},
		"assign_block":{
			"title": "Assign Block",
			"paths":[
				"/kfg_areas/assign_block/:id"
			]
		},
	},
	"order_assignment" : {
		"list":{
			"title": "List",
			"paths":[
				"/order_assignment",
				"/report/restaurant_branch_dropdown"
			]
		}
	},
	"order_assignment_process" : {
		"list":{
			"title": "List",
			"paths":[
				"/order_assignment_process/:order_id",
				"/report/restaurant_branch_dropdown"
			]
		}
	},
	"driver_petrol_consumption_report" : {
		"list": {
			"title": "List",
			"paths": [
				"/report/driver_petrol_consumption_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"view": {
			"title": "View",
			"paths": [
				"/report/driver_petrol_consumption_detail/:driver_id/:vehicle_type",
				'/report/petrol_consumption_detail_export/export_data'
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/petrol_consumption_list_export/export_data"
			]
		},
	},
	"average_unit_sold_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/average_unit_sold_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/average_unit_sold_report/export_data"
			]
		},
	},
	"average_basket_size_change_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/average_basket_size_change_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/average_basket_size_change_report/export_data"
			]
		},
	},
	"offer_only_customer_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/offer_only_customer_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/offer_only_customer_report/export_data"
			]
		},
	},
	"cuisine_sales_share_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/cuisine_sales_share_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/cuisine_sales_share_report/export_data"
			]
		},
	},
	"customer_segmentation_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/customer_segmentation_report",
				"/report/restaurant_branch_dropdown",
				"/report/get_area_list"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/customer_segmentation_report/export_data"
			]
		},
	},
	"customer_churn_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/customer_churn_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/customer_churn_report/export_data"
			]
		},
	},
	"order_frequency_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/order_frequency_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/order_frequency_report/export_data"
			]
		},
	},
	"restaurant_order_rate_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/restaurant_order_rate_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/restaurant_order_rate_report/export_data"
			]
		},
	},
	"transmission_time_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/transmission_time_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/transmission_time_report/export_data"
			]
		},
	},
	"transmission_time_report_one": {
		"list": {
			"title": "List",
			"paths": [
				"/report/transmission_time_report_one",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/transmission_time_report_one/export_data"
			]
		},
	},
	"operation_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/operation_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/operation_report/export_data"
			]
		},
	},
	"delivery_fees_revenue_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/delivery_fees_revenue_report",
				"/report/restaurant_branch_dropdown",
				"/report/city_area_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/delivery_fees_revenue_report/export_data"
			]
		},
	},
	"revenue_commission_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/revenue_commission_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/revenue_commission_report/export_data"
			]
		},
	},
	"all_order_customer_guest_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/all_order_customer_guest_report",
				"/report/restaurant_branch_dropdown",
				"/report/restaurant_area_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/all_order_customer_guest_report/export_data"
			]
		},
	},
	"sales_report" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/sales_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/sales_report/export_data"
			]
		},
	},
	"custom_reports" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/custom_reports",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/custom_reports/export_data"
			]
		},
	},
	"top_selling_restaurants" : {
		"list":{
			"title": "List",
			"paths":[
				"/report/top_selling_restaurants",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export":{
			"title": "Export",
			"paths":[
				"/report/top_selling_restaurants/export_data"
			]
		},
	},
	"restaurants_ranking_management": {
		"list": {
			"title": "List",
			"paths": [
				"/report/restaurants_ranking_management",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/restaurants_ranking_management/export_data"
			]
		},
	},
	"restaurant_busy_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/restaurant_busy_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/restaurant_busy_report/export_data"
			]
		},
	},
	"restaurants_order_summary": {
		"list": {
			"title": "List",
			"paths": [
				"/report/restaurants_order_summary",
				"/report/restaurants_order_summary/previous_data",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/restaurants_order_summary/export_data"
			]
		},
	},
	"area_sales_share_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/area_sales_share_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/area_sales_share_report/export_data"
			]
		},
	},
	"cancelled_orders_contribution_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/cancelled_orders_contribution_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/cancelled_orders_contribution_report/export_data"
			]
		},
	},
	"monthly_customer_breakdown_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/monthly_customer_breakdown_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/monthly_customer_breakdown_report/export_data"
			]
		},
	},
	"customer_report_server": {
		"list": {
			"title": "List",
			"paths": [
				"/report/customer_report_server",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/customer_report_server/export_data"
			]
		},
	},
	"customer_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/customer_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/customer_report/export_data"
			]
		},
	},
	"average_customer_order_value_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/average_customer_order_value_report",
				"/report/restaurant_branch_dropdown",
				"/report/restaurant_area_dropdown",
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/average_customer_order_value_report/export_data"
			]
		},
	},
	"redeem_every_offer_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/redeem_every_offer_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/redeem_every_offer_report/export_data"
			]
		},
	},
	"delivery_time_analysis_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/delivery_time_analysis_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/delivery_time_analysis_report/export_data"
			]
		},
	},
	"driver_productivity_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/driver_productivity_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/driver_productivity_report/export_data"
			]
		},
	},
	"area_analysis_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/area_analysis_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/area_analysis_report/export_data"
			]
		},
	},
	"captain_working_hours_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/captain_working_hours_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/captain_working_hours_report/export_data"
			]
		},
	},
	"drivers_compliant_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/drivers_compliant_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/drivers_compliant_report/export_data"
			]
		},
	},
	"abandoned_cart_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/abandoned_cart_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/abandoned_cart_report/export_data"
			]
		},
	},
	"drivers_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/drivers_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/drivers_report/export_data"
			]
		},
	},
	"restaurant_performance_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/restaurant_performance_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/restaurant_performance_report/export_data"
			]
		},
	},
	"area_performance_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/area_performance_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/area_performance_report/export_data"
			]
		},
	},
	"areas_contribution_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/areas_contribution_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/areas_contribution_report/export_data"
			]
		},
	},
	"cravez_orders_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/cravez_orders_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/cravez_orders_report/export_data"
			]
		},
	},
	"areas_contribution_half_yearly_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/areas_contribution_half_yearly_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/areas_contribution_half_yearly_report/export_data"
			]
		},
	},
	"cravez_orders_half_yearly_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/cravez_orders_half_yearly_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/cravez_orders_half_yearly_report/export_data"
			]
		},
	},
	"area_performance_half_yearly_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/area_performance_half_yearly_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/area_performance_half_yearly_report/export_data"
			]
		},
	},
	"restaurant_performance_half_yearly_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/restaurant_performance_half_yearly_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/restaurant_performance_half_yearly_report/export_data"
			]
		},
	},
	"restaurant_open_close_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/restaurant_open_close_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/restaurant_open_close_report/export_data"
			]
		},
	},
	"bi_analytics_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/bi_analytics_report",
				"/report/restaurant_branch_dropdown",
				"/report/get_item_list"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/bi_analytics_report/export_data"
			]
		},
	},
	"sales_staff_portfolio_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/sales_staff_portfolio_report",
				"/report/restaurant_branch_dropdown"
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/sales_staff_portfolio_report/export_data"
			]
		},
	},
	"order_payment_methods_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/order_payment_methods_report",
				"/report/restaurant_branch_dropdown",
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/order_payment_methods_report/export_data"
			]
		},
	},
	"cravez_sales_invoice_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/cravez_sales_invoice_report",
				"/report/restaurant_branch_dropdown",
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/cravez_sales_invoice_report/export_data"
			]
		},
	},
	"most_selling_items_with_relation": {
		"list": {
			"title": "List",
			"paths": [
				"/report/rest_most_selling_item_with_relations",
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/rest_most_selling_item_with_relations/export_data"
			]
		},
	},
	"orders_report": {
		"list": {
			"title": "List",
			"paths": [
				"/report/orders_report",
			]
		},
		"export": {
			"title": "Export",
			"paths": [
				"/report/orders_report/export_data"
			]
		},
	},
};
