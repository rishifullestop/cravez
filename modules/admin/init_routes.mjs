import { Router } from 'express';
import * as Constants from "../../config/global_constant.mjs";
import {send404Page} from "../../middleware/middleware.mjs";

export default async function getAdminRouter({ db, checkLoggedInAdmin, isLoggedIn }) {
    const router = Router();

    // List all your admin modules here (folder names)
    const adminModules = [
        "add_in_wallet",
        "admin_modules",
        "admin_permissions",
        "admin_role",
        "area_blocks",
        "areas",
        "ads_sliders",
        "assignment_slabs",
        "attribute_management",
        "attributes",
        "banner_management",
        "avaya_reports",
        "kfg_areas",
        "branch_offer_link",
        "language_settings",
        "captain_assigned",
        "captain_tracking",
        "category",
        "cities",
        "cms",
        "contact",
        "corporate_tie_ups",
        "cuisine_priorities",
        "cuisines",
        "user_management",
        "driver_breaks",
        "driver_excuses",
        "driver_in_out_shifts",
        "driver_leave_management",
        "driver_shifts",
        "email_actions",
        "email_logs",
        "email_template",
        "faq",
        "fleet_area_assignment",
        "public_composite",
        "report",
        "restaurants",
        "import_managers",
        "leave_management",
        "manage_vehicles",
        "master",
        "notifications",
        "notification_type",
        "offer_management",
        "orders",
        "order_tracking",
        "order_assignment",
        "overtime_captain_request",
        "overtime_request",
        "payment_transaction",
        "pn_logs",
        "push_notifications",
        "quality_category",
        "restaurant_cuisine",
        "restaurant_enquiries",
        "sales_reports",
        "screen_visit_logs",
        "settings",
        "shift_setup",
        "slider_management",
        "super_packages",
        "survey_management",
        "system_logs",
        "task_assignment",
        "sms_template",
        "text_group_setting",
        "team_breaks",
        "text_setting",
        "ticket_management",
        "users",
        "voc_management",
    ];

    try {
        // Dynamically import and initialize each module's routes
        for (const key of adminModules) {
            const tmpRoutes = await import(Constants.WEBSITE_ADMIN_MODULES_PATH + `${key}/routes.mjs`);
            tmpRoutes.default(router, { db, checkLoggedInAdmin, isLoggedIn });
        }
    } catch (error) {
        console.log("error ===>", error);
    }


    // 404 handler for all unmatched admin routes
    router.use((req, res) => {
        send404Page(req, res, true);
    });
    return router;
}