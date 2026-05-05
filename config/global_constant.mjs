/** Website root directory path */
export const WEBSITE_ROOT_PATH = process.env.PWD + "/";

/** Website Push notification server key for Android devices */
export const WEBSITE_PN_ANDROID_SERVER_KEY = process.env.ANDROID_SERVER_KEY;
/** Website Header Auth Key for mobile api */
export const WEBSITE_HEADER_AUTH_KEY = process.env.API_HEADER_AUTH_KEY;

/** Website/Socket Url*/
export const WEBSITE_URL = process.env.URL + ":" + process.env.PORT + "/";
export const WEBSITE_SOCKET_URL = process.env.URL;
export const WEBSITE_HOST_URL = process.env.HOST_URL + ":" + process.env.PORT + "/";
export const SERVER_IP = process.env.SERVER_IP;

/** Google API key*/
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
export const DISTANCE_GOOGLE_API = process.env.DISTANCE_GOOGLE_API;
export const GOOGLE_AUTO_COMPLETE_API_KEY = process.env.GOOGLE_AUTO_COMPLETE_API_KEY;
export const GOOGLE_MAP_SCRIPT = "https://maps.google.com/maps/api/js?&key=" + GOOGLE_API_KEY;

export const KFG_SOAP_API_URL = process.env.KFG_SOAP_API_URL;
export const KFG_SOAP_LICENCE_KEY = process.env.KFG_SOAP_LICENCE_KEY;

/** Where to upload files is UPLOAD_TO_SERVER is true file is uploaded on server another wise on local */
export const UPLOAD_SERVER_URL = process.env.UPLOAD_SERVER_URL;
export const UPLOAD_TO_SERVER = process.env.UPLOAD_TO_SERVER && JSON.parse(process.env.UPLOAD_TO_SERVER) || false;

/** Front end name **/
export const FRONT_END_NAME = "/";
/** Admin name **/
export const ADMIN_NAME = "admin";
/** Front end folder name */
export const FRONT_END_FOLDER_NAME = "frontend";

/** Front end folder name */
export const RESTAURANT_NAME = "restaurant_requests";

/** Admin folder name */
export const ADMIN_FOLDER_NAME = "admin";

/** Admin folder name */
export const COMMON_FOLDER_NAME = "common";

/** Website public folder path of front end*/
export const WEBSITE_FILES_URL = WEBSITE_URL + FRONT_END_FOLDER_NAME + "/";

export const WEBSITE_ADMIN_LOCAL_PUBLIC_PATH = WEBSITE_URL + ADMIN_FOLDER_NAME + "/";

/** Website public directory path */
export const WEBSITE_PUBLIC_PATH = UPLOAD_TO_SERVER ? UPLOAD_SERVER_URL : WEBSITE_URL + "public/";

/** Website public folder path of Admin panel*/
export const WEBSITE_ADMIN_FILES_URL = UPLOAD_TO_SERVER ? UPLOAD_SERVER_URL + ADMIN_FOLDER_NAME + "/" : WEBSITE_URL + ADMIN_FOLDER_NAME + "/";

/** Website public uploads directory path */
export const WEBSITE_PUBLIC_UPLOADS_PATH = UPLOAD_TO_SERVER ? UPLOAD_SERVER_URL + FRONT_END_FOLDER_NAME + "/" + "uploads/" : WEBSITE_PUBLIC_PATH + FRONT_END_FOLDER_NAME + "/uploads/";

/** Js file path for front pages of website */
export const WEBSITE_JS_PATH = UPLOAD_TO_SERVER ? UPLOAD_SERVER_URL + FRONT_END_FOLDER_NAME + "/js/" : WEBSITE_FILES_URL + "js/";
/** Css file path for front pages of website*/
export const WEBSITE_CSS_PATH = UPLOAD_TO_SERVER ? UPLOAD_SERVER_URL + FRONT_END_FOLDER_NAME + "/css/" : WEBSITE_FILES_URL + "css/";
/** Website images directory url */
export const WEBSITE_IMG_URL = WEBSITE_FILES_URL + "images/";
/** Website public images directory url */
export const WEBSITE_PUBLIC_IMG_URL = WEBSITE_PUBLIC_PATH + FRONT_END_FOLDER_NAME + "/images/";
/**Js plugin directory path */
export const WEBSITE_JS_PLUGIN_PATH = UPLOAD_TO_SERVER ? UPLOAD_SERVER_URL + FRONT_END_FOLDER_NAME + "/plugins/" : WEBSITE_FILES_URL + "plugins/";

/** Js Path for specific pages */
export const WEBSITE_JS_PAGE_PATH = WEBSITE_JS_PATH + "pages/";
/** Website Modules root path */
export const WEBSITE_MODULES_PATH = WEBSITE_ROOT_PATH + "modules/" + FRONT_END_FOLDER_NAME + "/";
/** Front layout root path */
export const WEBSITE_LAYOUT_PATH = WEBSITE_ROOT_PATH + "modules/" + FRONT_END_FOLDER_NAME + "/layouts/";

/** Website COMMON Modules root path */
export const WEBSITE_COMMON_MODULES_PATH = WEBSITE_ROOT_PATH + "modules/" + COMMON_FOLDER_NAME + "/";

/** Website Admin site Url */
export const WEBSITE_RESTAURANT_URL = WEBSITE_URL + RESTAURANT_NAME + "/";

/** Website Admin site Url */
export const WEBSITE_ADMIN_URL = WEBSITE_URL + ADMIN_NAME + "/";
/** Js file path for admin pages of website */
export const WEBSITE_ADMIN_JS_PATH = WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "js/";
/** Js Path for specific pages */
export const WEBSITE_ADMIN_JS_PAGE_PATH = WEBSITE_ADMIN_JS_PATH + "pages/";
/** Css file path for admin pages of website*/
export const WEBSITE_ADMIN_CSS_PATH = WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "css/";
/** Website images directory url for admin */
export const WEBSITE_ADMIN_IMG_URL = WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/";
/**Js plugin directory path */
export const WEBSITE_ADMIN_JS_PLUGIN_PATH = WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "plugins/";
/** Admin Modules root path */
export const WEBSITE_ADMIN_MODULES_PATH = WEBSITE_ROOT_PATH + "modules/" + ADMIN_FOLDER_NAME + "/";
/** Admin layout root path */
export const WEBSITE_ADMIN_LAYOUT_PATH = WEBSITE_ROOT_PATH + "modules/" + ADMIN_FOLDER_NAME + "/layouts/";

/** Website upload directory root path */
export const WEBSITE_UPLOADS_ROOT_PATH = WEBSITE_ROOT_PATH + "public/" + FRONT_END_FOLDER_NAME + "/uploads/";

/** For ads slider images file directory path and url */
export const ADS_SLIDER_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "ads_sliders/";
export const ADS_SLIDER_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "ads_sliders/";
export const POSITION_1_IMAGE_RESOLUTION = "566*585";
export const POSITION_2_3_IMAGE_RESOLUTION = "565*278";
export const POSITION_4_IMAGE_RESOLUTION = "1169*137";

/** Directory name on s3 server */
export const SERVER_FILE_PATHS = {};
export const SERVER_PATH_PREFIX = "frontend/uploads/";

/** For User images file directory path and url*/
export const USERS_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "user/";
export const USERS_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "user/";

/** For Menu Manager images file directory path and url*/
export const MENU_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "menu/";
export const MENU_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "menu/";

/** For Category Manager images file directory path and url*/
export const CATEGORIES_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "category_managers/";
export const CATEGORIES_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "category_managers/";

/** For Import Managers images file directory path and url*/
export const IMPORT_MANAGER_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "import_managers/";
export const IMPORT_MANAGER_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "import_managers/";
export const IMPORT_MANAGER_IMAGE_RESOLUTION = "1202*424";

/** For Restaurant images file directory path and url*/
export const RESTAURANT_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "restaurant/";
export const RESTAURANT_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "restaurant/";
export const RESTAURANT_FILE_RESOLUTION = "1202*424";
export const RESTAURANT_WEB_FILE_RESOLUTION = "1920*335";

/** For Merchant file directory path and url*/
export const MERCHANT_FILES_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "merchant_files/";
export const MERCHANT_FILES_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "merchant_files/";
export const MERCHANT_SAMPLE_FILE_URL = WEBSITE_FILES_URL + "uploads/merchant_files/";

/** For import user directory path and url*/
export const IMPORT_USER_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "import_user/";
export const IMPORT_USER_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "import_user/";

/** For setting images file directory path and url*/
export const SETTING_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "settings/";
export const SETTING_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "settings/";

/** For Master images file directory path and url*/
export const MASTER_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "masters/";
export const MASTER_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "masters/";
export const MASTER_IMAGE_RESOLUTION = "1202*424";

/** For ck editor file directory path and url*/
export const CK_EDITOR_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "ckeditor_uploader/";
export const CK_EDITOR_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "ckeditor_uploader/";
export const CK_EDITOR_IMAGE_URL = 'public/' + FRONT_END_FOLDER_NAME + '/uploads/ckeditor_uploader/';

/** For slider image file directory path and url*/
export const SLIDER_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "slider_image/";
export const SLIDER_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "slider_image/";

/** For pn image file directory path and url*/
export const PN_IMAGE_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "pn_image/";
export const PN_IMAGE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "pn_image/";

/** For Item images file directory path and url*/
export const ITEMS_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "items/";
export const ITEMS_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "items/";
export const ITEMS_FILE_RESOLUTION = "1202*424";

/** For order images file directory path and url*/
export const ORDERS_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "orders/";
export const ORDERS_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "orders/";

/** For restaurant on boarding file directory path and url*/
export const RESTAURANT_ONBOARDING_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "restaurant_onboarding/";
export const RESTAURANT_ONBOARDING_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "restaurant_onboarding/";

/** Urls of commonly used images */
export const NO_IMAGE_AVAILABLE = WEBSITE_PUBLIC_UPLOADS_PATH + "no-image.png";
export const ADD_PROFILE_IMAGE_ICON = WEBSITE_PUBLIC_UPLOADS_PATH + 'user-no-image.png';
export const DATATABLE_LOADER_IMAGE = WEBSITE_PUBLIC_IMG_URL + "Loading_icon.gif";
export const IMAGE_FIELD_NAME = "full_image_path";

/** For Offer management images file directory path and url*/
export const OFFER_MANAGEMENT_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "offer_management/";
export const OFFER_MANAGEMENT_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "offer_management/";
export const OFFER_MANAGEMENT_FILE_RESOLUTION = "1202*424";

/** For vehicle image file directory path and url*/
export const MANAGE_VEHICLE_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "manage_vehicle/";
export const MANAGE_VEHICLE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "manage_vehicle/";

/** For vehicle image file directory path and url*/
export const DRIVER_MANAGEMENT_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "driver_management/";
export const DRIVER_MANAGEMENT_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "driver_management/";

/** For banner image file directory path and url*/
export const BANNER_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "banner_image/";
export const BANNER_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "banner_image/";
export const BANNER_IMAGE_RESOLUTION = "1354*680";

/** For order invoice file directory path and url*/
export const ORDER_INVOICE_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "order_invoice/";
export const ORDER_INVOICE_FILE_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "order_invoice/";

/** User role ids */
export const FRONT_USER_ROLE_ID = "5b6bc82b1dd6a1219e632b04";

/** Front user roles */
export const CUSTOMER = "5e144b3f195462a80a67554a";
export const DRIVER = "5e144b28195462a80a66a04e";
export const FLEET = "5e5e1c4f20f64132ee9e0030";
export const RESTAURANT_EMPLOYEE = "5dfa202390130c3865c36976";
export const RESTAURANT_BRANCH_MANAGER = "5dfa1ff190130c3865c36975";

/** Admin user roles */
export const CRAVEZ = "5b6bc8111dd6a1219e632b03";
export const RESTAURANT = "5b6bc8351dd6a1219e632b05";
export const CONTENT_TEAM = "5dde3179bc18ea23514eb855";
export const QA_TEAM = "5e030f37ffa2e817309884c6";
export const CALL_CENTER_TEAM = "5e030f31ffa2e817309884c5";
export const SALES_TEAM = "5def387519acde613e84f02f";
export const MARKETING_TEAM = "5e6f122031fdc779273b41e7";
export const BACK_OFFICE_TEAM = "5e9e8eadbf4d8c0f517187ae";
export const SUPERVISOR = "5ecd08622d3250030cb47613";
export const FINANCE_TEAM = "5ef049744a63c74f5ad8b8a5";
export const SYSTEM_ADMIN_ROLE_ID = "61d6b36765b3651fd91294e5";

/** Max string limit of long text in datatable **/
export const STRING_MAX_LIMIT_IN_DATATABLE = 200;

/** Text Setting types*/
export const TEXT_SETTINGS_ADMIN = "admin";
export const TEXT_SETTINGS_FRONT = "front";

/** Name of text setting types*/
export const TEXT_SETTINGS_NAME = {
	[TEXT_SETTINGS_ADMIN]: "Admin Text Settings",
	[TEXT_SETTINGS_FRONT]: "Front Text Settings"
};

/** Text Setting types*/
export const TEXT_SEARCH_DROPDOWN = [
	{ status_id: TEXT_SETTINGS_ADMIN, status_name: "Admin" },
	{ status_id: TEXT_SETTINGS_FRONT, status_name: "Front" },
];

/** Time Configurations */
export const DAYS_IN_A_WEEK = 7;
export const SINGLE_DAY = 1;
export const HOURS_IN_A_DAY = 24;
export const MINUTES_IN_A_HOUR = 60;
export const SECONDS_IN_A_MINUTE = 60;
export const MILLISECONDS_IN_A_SECOND = 1000;
export const SECONDS_IN_A_HOUR = 3600;
export const DAY_IN_A_MONTH = 30;
export const HOURS_IN_A_YEAR = HOURS_IN_A_DAY * 365;
export const RECENT_CUSTOMER_DAYS = 7;

/** url validation */
export const URL_REGEX = '^(https?|chrome):\/\/[^\s$.?#].[^\s]*$';

/** Time stamp of one day*/
export const ONE_DAY_TIMESTAMP = HOURS_IN_A_DAY * MINUTES_IN_A_HOUR * SECONDS_IN_A_MINUTE * MILLISECONDS_IN_A_SECOND;

/** Commonly used status **/
export const ACTIVE = 1;
export const DEACTIVE = 0;
export const VERIFIED = 1;
export const NOT_VERIFIED = 0;
export const DELETED = 1;
export const NOT_DELETED = 0;
export const NOT_SEEN = 0;
export const SEEN = 1;
export const NOT_READ = 0;
export const READ = 1;
export const SENT = 1;
export const NOT_SENT = 0;
export const SHOWN = 1;
export const NOT_SHOWN = 0;
export const NOT_REGISTER = 0;
export const REGISTER = 1;
export const NOT_VISIBLE = 0;
export const VISIBLE = 1;
export const NOT_AVAILABLE = 0;
export const AVAILABLE = 1;
export const OFFLINE = 0;
export const ONLINE = 1;
export const DEFAULT = 0;
export const START_DATE = '01';
export const END_DATE = 31;
export const PENDING = 0;
export const IN_REVIEW = 1;
export const APPROVED = 2;
export const REJECTED = 3;
export const CANCELLED = 4;
export const CLOSE = 0;
export const OPEN = 1;
export const ON_LEAVE = 1;
export const NOT_LEAVE = 0;
export const BUSY = 0;
export const DEBIT = 0;
export const CREDIT = 1;
export const TAKEN = 1;
export const NOT_LIVE = 0;
export const LIVE = 1;
export const SUBSCRIBED = 1;
export const NON_SELLABLE = 1;
export const PRICE_ON_SELECTION = 1;
export const ACCEPT = 1;
export const FAVOURITE = 1;
export const UNFAVOURITE = 0;
export const FORCE_ACTIVE = 1;
export const FORCE_DEACTIVE = 0;
export const BLACKLISTED = 1;
export const NOT_BLACKLISTED = 0;
export const DOUBLE_CASHBACK = 1;
export const VOC_SUBMITTED = 1;
export const FEATURED = 1;
export const UNFEATURED = 1;
export const UNSUSPEND = 0;
export const SUSPEND = 1;
export const METER_IN_1_KM = 1000;

/** Gender type*/
export const MALE = "male";
export const FEMALE = "female";
export const OTHER = "other";

export const GENDER_DROPDOWN = {
	[MALE]: "Male",
	[FEMALE]: "Female",
	[OTHER]: "Other"
};

/** Delivery vehicle type */
export const CAR = "car";
export const BIKE = "bike";

export const DELIVERY_VEHICLE_DROPDOWN = {
	[CAR]: "Car",
	[BIKE]: "Bike",
};

/** "Stay Signed In" Expire time for admin  */
export const ADMIN_LOGGED_IN_COOKIE_EXPIRE_TIME = 14 * ONE_DAY_TIMESTAMP;

/** Type of Flash messages */
export const STATUS_SUCCESS = "success";
export const STATUS_ERROR = "error";

/** Show / Hide "Stay Signed In" Option in admin */
export const ALLOWED_ADMIN_TO_SET_COOKIE = DEACTIVE;

/** Default number of records to be shown in admin */
export const ADMIN_LISTING_LIMIT = 10;
export const FRONT_LISTING_LIMIT = 10;

/** On submit loading text */
export const ADMIN_LOADING_TEXT = 'data-loading-text=\' Loading...\'';
export const FRONT_LOADING_TEXT = 'data-loading-text=\' Loading...\'';

export const ENGLISH_LANGUAGE_FOLDER_CODE = "en";
export const ENGLISH_LANGUAGE_CODE = "en";
export const ENGLISH_LANGUAGE_MONGO_ID = "5a3a13238481824b077b23ca";

export const ARABIC_LANGUAGE_FOLDER_CODE = "ar";
export const ARABIC_LANGUAGE_CODE = "ar";
export const ARABIC_LANGUAGE_MONGO_ID = "5df9e78c517e7105741a1623";

/** Default language configurations */
export const DEFAULT_LANGUAGE_FOLDER_CODE = ENGLISH_LANGUAGE_FOLDER_CODE;
export const DEFAULT_LANGUAGE_CODE = ENGLISH_LANGUAGE_CODE;
export const DEFAULT_LANGUAGE_MONGO_ID = ENGLISH_LANGUAGE_MONGO_ID;

export const LANGUAGES_IN_SYSTEM = [ENGLISH_LANGUAGE_MONGO_ID, ARABIC_LANGUAGE_MONGO_ID];

export const SYSTEM_LANGUAGES = [
	{ id: ENGLISH_LANGUAGE_MONGO_ID, code: ENGLISH_LANGUAGE_CODE },
	{ id: ARABIC_LANGUAGE_MONGO_ID, code: ARABIC_LANGUAGE_CODE },
];

/** Arabic language configurations */
export const LANGUAGE_CODES = {
	[ENGLISH_LANGUAGE_MONGO_ID]: ENGLISH_LANGUAGE_CODE,
	[ARABIC_LANGUAGE_MONGO_ID]: ARABIC_LANGUAGE_CODE,
};

/** Upload image configurations*/
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];
export const ALLOWED_IMAGE_ERROR_MESSAGE = "Please select valid file, Valid file extensions are " + ALLOWED_IMAGE_EXTENSIONS.join(", ") + ".";

export const ALLOWED_IMAGE_MIME_EXTENSIONS = ["image/jpg", "image/jpeg", "image/png"];
export const ALLOWED_IMAGE_MIME_ERROR_MESSAGE = "Please select valid mime type, Valid mime types are " + ALLOWED_IMAGE_MIME_EXTENSIONS.join(", ") + ".";
export const IMAGE_RESOLUTION = "1202*424";

/** Document upload configurations*/
export const DOCUMENT_ATTACHMENT_EXTENSIONS = ['pdf', 'xls', 'doc', 'docx', 'xlsx', 'ppt', 'pptx'];
export const DOCUMENT_ATTACHMENT_ERROR_MESSAGE = 'Please select valid file, Valid file extensions are ' + DOCUMENT_ATTACHMENT_EXTENSIONS.join(', ') + ".";
export const DOCUMENT_MIME_EXTENSIONS = ['application/pdf', 'application/doc', "application/msword", 'application/docx', "application/octet-stream", 'application/xlsx', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 'application/xls', 'application/vnd.ms-excel', 'application/vnd.ms-office', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export const DOCUMENT_MIME_ERROR_MESSAGE = 'Please select valid mime type, Valid mime types is ' + DOCUMENT_MIME_EXTENSIONS.join(', ') + ".";

export const DOCUMENT_ATTACHMENT_ICONS = {
	"txt": WEBSITE_PUBLIC_IMG_URL + "txt_icon.png",
	"doc": WEBSITE_PUBLIC_IMG_URL + "doc_icon.png",
	"docx": WEBSITE_PUBLIC_IMG_URL + "doc_icon.png",
	"pdf": WEBSITE_PUBLIC_IMG_URL + "pdf_icon.png",
	"xls": WEBSITE_PUBLIC_IMG_URL + "xls_icon.png",
	"xlsx": WEBSITE_PUBLIC_IMG_URL + "xls_icon.png",
	"ppt": WEBSITE_PUBLIC_IMG_URL + "ppt_icon.png",
	"pptx": WEBSITE_PUBLIC_IMG_URL + "ppt_icon.png"
};

/** Upload image configurations*/
export const ALLOWED_IMPORT_MANAGER_EXTENSIONS = ["csv", "xlsx", "xls", "txt", "xlsm"];
export const ALLOWED_IMPORT_MANAGER_ERROR_MESSAGE = "Please select valid file, Valid file extensions are " + ALLOWED_IMPORT_MANAGER_EXTENSIONS.join(", ") + ".";

export const ALLOWED_IMPORT_MANAGER_MIME_EXTENSIONS = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream", "text/plain", "application/vnd.ms-excel.sheet.macroEnabled.12"];
export const ALLOWED_IMPORT_MANAGER_MIME_ERROR_MESSAGE = "Please select valid mime type, Valid mime types are " + ALLOWED_IMPORT_MANAGER_MIME_EXTENSIONS.join(", ") + ".";

/** Upload merchant file configurations*/
export const CSV_FILE_EXTENSION = "csv";
export const ALLOWED_MERCHANT_FILE_EXTENSIONS = ["txt", "csv"];
export const ALLOWED_MERCHANT_FILE_ERROR_MESSAGE = "Please select valid file, Valid file extensions are " + ALLOWED_MERCHANT_FILE_EXTENSIONS.join(", ") + ".";

export const ALLOWED_MERCHANT_FILE_MIME_EXTENSIONS = ["text/plain", "text/csv"];
export const ALLOWED_MERCHANT_FILE_MIME_ERROR_MESSAGE = "Please select valid mime type, Valid mime types are " + ALLOWED_MERCHANT_FILE_MIME_EXTENSIONS.join(", ") + ".";

/** Import User configurations*/
export const ALLOWED_IMPORT_USER_EXTENSIONS = ["csv"];
export const ALLOWED_IMPORT_USER_ERROR_MESSAGE = "Please select valid file, Valid file extension is " + ALLOWED_IMPORT_USER_EXTENSIONS.join(", ") + ".";

export const ALLOWED_IMPORT_USER_MIME_EXTENSIONS = ["text/plain", "text/csv"];
export const ALLOWED_IMPORT_USER_MIME_ERROR_MESSAGE = "Please select valid mime type, Valid mime type is " + ALLOWED_IMPORT_USER_MIME_EXTENSIONS.join(", ") + ".";

/** Upload image configurations*/
export const ALLOWED_RESTAURANT_ONBOARDING_EXTENSIONS = ["csv", "xlsx", "xls", "txt", "xlsm"];
export const ALLOWED_RESTAURANT_ONBOARDING_ERROR_MESSAGE = "Please select valid file, Valid file extensions are " + ALLOWED_RESTAURANT_ONBOARDING_EXTENSIONS.join(", ") + ".";

export const ALLOWED_RESTAURANT_ONBOARDING_MIME_EXTENSIONS = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream", "text/plain", "application/vnd.ms-excel.sheet.macroEnabled.12"];
export const ALLOWED_RESTAURANT_ONBOARDING_MIME_ERROR_MESSAGE = "Please select valid mime type, Valid mime types are " + ALLOWED_RESTAURANT_ONBOARDING_MIME_EXTENSIONS.join(", ") + ".";

/** Not allowed html tags list*/
export const NOT_ALLOWED_TAGS_XSS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*/gi];

/** Allow iframe in add/edit product (Youtube embedded code) **/
export const NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi];

/** Date Formats  for server side (node js) **/
export const DATABASE_DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss";// 2018-01-01 00:00:00
export const DATABASE_DATE_FORMAT = "yyyy-MM-dd"; // 2018-01-01
export const DATE_FORMAT_EXPORT = "dd/MM/yyyy";
export const DATE_FORMAT_EMAIL = "dd/MM/yyyy";
export const DATE_OF_BIRTH_FORMAT = "yyyy-mm-dd"; // 2018-01-01
export const AM_PM_FORMAT_WITH_DATE = "yyyy-MM-dd hh:MM TT"; // 2018-01-01 12:00 AM
export const MONTH_DATE_FORMAT = "M"; // 1
export const DAY_DATE_FORMAT = "dd"; // 1
export const YEAR_DATE_FORMAT = "yyyy"; // 1
export const START_DATE_TIME_FORMAT = "00:00:00";
export const END_DATE_TIME_FORMAT = "23:59:59";
export const DAY_FORMAT = "dddd";
export const DAY_INITIAL_START_TIME = "00:00";
export const DAY_INITIAL_END_TIME = "23:59";
export const BREAK_TIME_FORMAT = "HH:mm";
export const OPEN_TIME_FORMAT = "HH:mm";
export const SHIFT_TIME_FORMAT = "HH.mm";
export const EXCUSES_TIME_FORMAT = "HH.mm";
export const AREA_PROFILE_TIME_FORMAT = "HH.mm";
export const ORDER_YEAR_FORMAT = "yy";
export const ORDER_HOUR_MINUTE_SECOND_FORMAT = "HHMMss";
export const DELIVERED_GRAPH_DATE_FORMAT = "dd-MMMM-yyyy";
export const REPORT_DATE_FORMAT = "dd-mm-yyyy";
export const DATE_TIME_RANGE_FORMAT = "dd/MM/yyyy hh:mm a";
export const REPORT_DATATABLE_DATE_FORMAT = "DD-MM-YYYY";
export const EXCEL_DATE_FORMAT = "DD-MM-YYYY";
export const EXCEL_TIME_FORMAT = "HH:MM:SS AM/PM";
export const EXCEL_CURRENCY_FORMAT = "0.000";
export const EXCEL_NUMBER_FORMAT = "0.00";
export const EXCEL_DATE_TIME_FORMAT = "DD-MM-YYYY HH:MM:SS AM/PM";

export const CURRENTDATE_START_DATE_FORMAT = "yyyy-MM-dd 00:00:00";
export const CURRENTDATE_END_DATE_FORMAT = "yyyy-MM-dd 23:59:59";
export const TIME_FORMAT = "hh:mm:ss TT";
export const AVAYA_TIME_FORMAT = "HH:mm:ss";

/**Date formats For client side only */
export const FRONT_DATE_FORMAT = "DD/MM/YYYY hh:mm a"; // 31/01/2018 00:00 PM
export const DATATABLE_DATE_TIME_FORMAT = "DD/MM/YYYY hh:mm a";
export const DATATABLE_DATE_FORMAT = "DD/MM/YYYY";
export const DATE_FORMAT_HTML = "DD/MM/YYYY";
export const FRONT_TIME_FORMAT = "hh:mm:ss A";

/** Date formats used in date-range picker */
export const DATEPICKER_DATE_TIME_FORMAT = "DD/MM/YYYY hh:mm A";
export const DATEPICKER_DATE_FORMAT = "DD/MM/YYYY";
export const DATEPICKER_START_DATE_FORMAT = "YYYY-MM-DD 00:00:00";
export const DATEPICKER_END_DATE_FORMAT = "YYYY-MM-DD 23:59:59";
export const DATE_RANGE_DISPLAY_FORMAT_FOR_START_DATE = "YYYY-MM-DD HH:mm:00";
export const DATE_RANGE_DISPLAY_FORMAT_FOR_END_DATE = "YYYY-MM-DD 23:59:59";
export const DATE_RANGE_DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm";
export const DATE_RANGE_DATE_FORMAT = "YYYY-MM-DD";
export const DATE_PICKER_DATE_TIME_FORMAT = "YYYY-MM-DD hh:mm A";
export const DATEPICKER_TIME_FORMAT = "HH:mm";
export const MONTH_YEAR_FORMAT = "yyyy-mm";
/** Date picker date example*/
export const DATEPICKER_DATE_EXAMPLE = "Ex: 2019-03-24 23:59";

/** only for listing purpose, do not used this in any date format */
export const DEFAULT_DAY_INITIAL_START_TIME_24_FORMAT = "00.00";
export const DEFAULT_DAY_INITIAL_END_TIME_24_FORMAT = "23.59";

/** Time zone used in html **/
export const DEFAULT_TIME_ZONE = process.env.TZ;

/** To show error message on top of page **/
export const ADMIN_GLOBAL_ERROR = "invalid-access";
export const FRONT_GLOBAL_ERROR = "invalid-access";

/** Data-table configurations **/
export const SORT_DESC = -1;
export const SORT_ASC = 1;
export const DEFAULT_SKIP = 0;

/** Loading button text, default is loading.. **/
export const LOADING_BUTTON_TEXT = 'data-loading-text=\'<i class="fa fa-save"></i> Loading...\'';
export const LOADING_SPINNER = '<div class=\'ld ld-ring ld-spin\'></div>';

/** Default country code */
export const DEFAULT_COUNTRY_CODE = "+965";

/** Allowed Mobile number length configuration **/
export const MOBILE_NUMBER_MIN_LENGTH = 8;
export const MOBILE_NUMBER_MAX_LENGTH = 8;
export const MOBILE_LENGTH_VALIDATION = { min: MOBILE_NUMBER_MIN_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH };
export const MOBILE_NUMBER_LENGTH = [MOBILE_LENGTH_VALIDATION];

/** Allowed landline number length configuration **/
export const LANDLINE_NUMBER_LENGTH = 8;

/** Password length configuration **/
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_LENGTH_VALIDATION = { min: PASSWORD_MIN_LENGTH };
export const PASSWORD_LENGTH = [PASSWORD_LENGTH_VALIDATION];

/** Email and Mobile validation regular expression (use in login function for front) **/
/** Email and 10 digit mobile number validation */
export const EMAIL_REGULAR_EXPRESSION = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const MOBILE_REGULAR_EXPRESSION = /^[0-9]$/;
export const EMAIL_AND_MOBILE_REGULAR_EXPRESSION = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})|([0-9])+$/;
export const EMAIL_AND_MOBILE_REGULAR_EXPRESSION_FOR_CLIENT_SIDE = "^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})|(^[0-9])+$";
export const MOBILE_NUMBER_REGULAR_EXPRESSION = "^[0-9]$";
export const TICKET_MOBILE_EXPRESSION = /^([+]{1})([0-9]{11})+$/;// allow country code
export const USER_NAME_EXPRESSION = /^([a-zA-Z])+$/;// allow character code
export const VALID_NUMBER_REGEX = /^[0-9]+$/;
export const VALID_FLOAT_REGEX 	= /^[0-9]+([.][0-9]+)?$/;

/** settings input value required and editable status **/
export const REQUIRED = 1;
export const EDITABLE = 1;

/** Round precision (default number of decimal digits to round to) **/
export const ROUND_PRECISION = 2;
export const CURRENCY_ROUND_PRECISION = 3;
export const ROUND_GRAPH_PRECISION = 1;

/** Dashboard redirect type **/
export const TYPE_ACTIVE = "active";
export const TYPE_DEACTIVE = "deactive";

/**Search Status for users **/
export const SEARCHING_ACTIVE = 1;
export const SEARCHING_DEACTIVE = 2;
export const SEARCHING_VERIFIED = 3;
export const SEARCHING_NOT_VERIFIED = 4;

/** Search status for customer **/
export const USER_STATUS_SEARCH_DROPDOWN = [
	{ status_id: SEARCHING_ACTIVE, status_name: "Active", status_type: TYPE_ACTIVE },
	{ status_id: SEARCHING_DEACTIVE, status_name: "Deactive", status_type: TYPE_DEACTIVE },
	{ status_id: SEARCHING_VERIFIED, status_name: "Verified" },
	{ status_id: SEARCHING_NOT_VERIFIED, status_name: "Not Verified" }
];

/** Comman Status **/
export const COMMAN_STATUS_SEARCH_DROPDOWN = {
	[PENDING]: { status_name: "Pending", class: "label-warning" },
	[IN_REVIEW]: { status_name: "In-Review", class: "label-primary" },
	[APPROVED]: { status_name: "Approved", class: "label-success" },
	[REJECTED]: { status_name: "Disapproved", class: "label-danger" },
};

/** Status labels **/
export const STATUS_LABELS = {
	[PENDING]: { status_name: "Pending", class: "label-warning" },
	[IN_REVIEW]: { status_name: "In-Review", class: "label-primary" },
	[APPROVED]: { status_name: "Approved", class: "label-success" },
	[REJECTED]: { status_name: "Disapproved", class: "label-danger" },
};

/** Status labels **/
export const TEAM_BREAK_STATUS = {
	[PENDING]: { status_name: "Pending", class: "label-warning" },
	[APPROVED]: { status_name: "Approved", class: "label-success" },
	[REJECTED]: { status_name: "Disapproved", class: "label-danger" },
};

/** Type Of Export Records **/
export const EXPORT_ALL = "export_all";
export const EXPORT_FILTERED = "export_filtered";

/** Search status for global section **/
export const GLOBAL_STATUS_SEARCH_DROPDOWN = {
	[ACTIVE]: { status_type: TYPE_ACTIVE, status_name: "Active", label_class: "label-success" },
	[DEACTIVE]: { status_type: TYPE_DEACTIVE, status_name: "Deactive", label_class: "label-danger" },
};

/** Search status for FAQ **/
export const FAQ_SEARCH_DROPDOWN = [
	{ status_id: ACTIVE, status_name: "Active", status_type: TYPE_ACTIVE },
	{ status_id: DEACTIVE, status_name: "Deactive", status_type: TYPE_DEACTIVE }
];

/** For data table data types **/
export const NUMERIC_FIELD = 'numeric';
export const OBJECT_ID_FIELD = 'objectId';
export const EXACT_FIELD = 'exact';

/** For status use in redirect page with status (user listing) **/
export const ACTIVE_INACTIVE_STATUS = "active_inactive";
export const VERIFIED_STATUS = "verified_user";

/** Setting validate type dropdown **/
export const SETTINGS_VALIDATE_TYPE_DROPDOWN = [
	{ input_id: "number", input_name: "Number" },
	{ input_id: "float", input_name: "Float" },
	{ input_id: "percentage", input_name: "Percentage" },
	{ input_id: "start_time", input_name: "Start Time" },
	{ input_id: "end_time", input_name: "End Time" },
];

export const SETTINGS_VALIDATE_FILE_TYPE_DROPDOWN = [
	{ input_id: "valid_image", input_name: "Valid Image" },
	{ input_id: "valid_document", input_name: "Valid Document" },
	{ input_id: "other", input_name: "Other" },
];

/** Setting input type dropdown **/
export const SETTING_INPUT_TYPE_DROPDOWN = [
	{ input_id: "text", input_name: "Text" },
	{ input_id: "textarea", input_name: "Textarea" },
	{ input_id: "checkbox", input_name: "Check Box" },
	{ input_id: "file", input_name: "File" },
	{ input_id: "ck_editor", input_name: "Ck Editor" },
	{ input_id: "time", input_name: "Time Picker" },
];

/** Not allowed characters in regular expresssion **/
export const NOT_ALLOWED_CHARACTERS_FOR_REGEX = ['(', ')', '+', '*', '?', '[', ']'];

/**Not deletable role */
export const NOT_DELETABLE_ROLE = 1;

/** Two show only sub-admin */
export const IS_SUBADMIN = 1;

/** Notification display limit in admin header */
export const ADMIN_HEADER_NOTIFICATION_DISPLAY_LIMIT = 5;
export const FRONT_HEADER_NOTIFICATION_DISPLAY_LIMIT = 5;

/** Guest order place limit */
export const GUEST_USER_ORDER_LIMIT = 2;

/**  NOTIFICATION TYPE */
export const NOTIFICATION_USER_REGISTER = 1;
export const NOTIFICATION_BRANCH_APPROVAL_REQUEST = 2;
export const NOTIFICATION_BRANCH_APPROVAL_REQUEST_STATUS_UPDATE = 3;
export const NOTIFICATION_RESTAURANT_ENQUIRY_REQUEST = 4;
export const NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST = 5;
export const NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST = 6;
export const NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST_STATUS_UPDATE = 7;
export const NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST_STATUS_UPDATE = 8;
export const NOTIFICATION_TICKET_ASSIGNED = 9;
export const NOTIFICATION_TICKET_REOPENED_AND_ASSIGNED = 10;
export const NOTIFICATION_OVERTIME_REQUEST = 11;
export const NOTIFICATION_DRIVER_REGISTER = 12;
export const NOTIFICATION_CUSTOMER_REGISTER = 13;
export const NOTIFICATION_SEND_LOGIN_CREDENTIALS = 14;
export const NOTIFICATION_ADMIN_USER_REGISTER = 15;
export const NOTIFICATION_VACATION_REQUEST = 16;
export const NOTIFICATION_WEEKLY_REQUEST = 17;
export const NOTIFICATION_FRONT_CUSTOMER_REGISTER = 18;
export const NOTIFICATION_FRONT_DRIVER_REGISTER = 19;
export const NOTIFICATION_TEAM_BREAK_REQUEST_POST = 20;
export const NOTIFICATION_TEAM_BREAK_APPROVE_REJECT = 21;
export const NOTIFICATION_CUISINE_PRIORITIES_SEND_FOR_APPROVAL = 22;
export const NOTIFICATION_CUISINE_PRIORITIES_REJECTED = 23;
export const NOTIFICATION_CUISINE_PRIORITIES_APPROVED = 24;
export const NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST_STATUS_UPDATE = 25;
export const NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST = 26;
export const NOTIFICATION_DRIVER_BREAK_REQUEST_POST = 27;
export const NOTIFICATION_DRIVER_BREAK_APPROVE_REJECT = 28;
export const NOTIFICATION_EXCUSES_REQUEST_POST = 29;
export const NOTIFICATION_DRIVER_EXCUSES_APPROVE_REJECT = 30;
export const NOTIFICATION_ADD_IN_WALLET = 31;
export const NOTIFICATION_ORDER_PENDING = 32;
export const NOTIFICATION_ORDER_PREPARING = 33;
export const NOTIFICATION_ORDER_READY_TO_PICK_UP = 34;
export const NOTIFICATION_ORDER_ON_THE_WAY = 35;
export const NOTIFICATION_ORDER_REJECTED = 36;
export const NOTIFICATION_ORDER_CANCELLED = 37;
export const NOTIFICATION_ORDER_DELIVERED = 38;
export const NOTIFICATION_ORDER_MODIFIED = 39;
export const NOTIFICATION_ORDER_CONFIRMED = 40;
export const NOTIFICATION_CAPTAIN_OVERTIME_REQUEST = 41;
export const NOTIFICATION_TRANSFER_BALANCE = 42;
export const NOTIFICATION_SEND_TO_USERS_ORDER_REMIND = 43;
export const NOTIFICATION_TO_DRIVER_ORDER_READY_TO_PICK_UP = 44;
export const NOTIFICATION_DRIVER_ACCEPTED_ORDER = 45;
export const NOTIFICATION_DRIVER_ASSIGNED_ORDER = 46;
export const NOTIFICATION_DRIVER_ARRIVED_ORDER = 47;
export const NOTIFICATION_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION = 48;
export const NOTIFICATION_ORDER_CANCELLED_TO_DRIVER = 49;
export const NOTIFICATION_ORDER_WAY_AT_CUSTOMER_LOCATION = 50;
export const NOTIFICATION_PURCHASE_PACKAGE = 51;
export const NOTIFICATION_PURCHASE_PACKAGE_STATUS = 52;
export const NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER = 53;
export const NOTIFICATION_TO_GUEST_FOR_EXCEEDED_ORDER_LIMIT = 54;
export const NOTIFICATION_ORDER_PROBLEMATIC = 55;
export const NOTIFICATION_DRIVER_BREAK_CANCEL = 56;
export const NOTIFICATION_DRIVER_BREAK_ADD = 57;
export const NOTIFICATION_DRIVER_EXCUSES_CANCEL = 58;
export const NOTIFICATION_CART_ITEMS_PENDING = 59;
export const NOTIFICATION_ORDER_OUTSTANDING_AMOUNT_PAID = 60;
export const NOTIFICATION_DRIVER_BREAK_END = 61;
export const NOTIFICATION_SCHEDULED_PUSH_NOTIFICATION = 62;
export const NOTIFICATION_ADD_WALLET_AMOUNT = 63;
export const NOTIFICATION_DRIVER_BREAK_ENDED = 64;
export const NOTIFICATION_ORDER_DELAY_VOC_PN = 65;
export const NOTIFICATION_SHIFT_NOT_JOIN_PN_DRIVER = 66;
export const NOTIFICATION_SHIFT_NOT_JOIN_PN_CRAVEZ = 67;
export const NOTIFICATION_BREAK_EXCUSE_IMMEDIATELY_CANCELED = 68;
export const NOTIFICATION_TO_DRIVER_LOGIN_IN_ANOTHER_DEVICE = 69;
export const NOTIFICATION_FOR_RESTAURANT_UPDATED_PASSWORD = 70;
export const NOTIFICATION_TO_FLEET_DRIVER_SWITCH_OFF_PHONE_GPS = 71;
export const NOTIFICATION_TO_FLEET_ORDER_MARKED_PROBLEMATIC = 72;
export const NOTIFICATION_TO_DRIVER_ORDER_UNDO_ASSIGNED = 73;
export const NOTIFICATION_TO_DRIVER_ORDER_ADDRESSED_CHANGED = 74;

export const NOTIFICATION_MESSAGES = {
	[NOTIFICATION_USER_REGISTER]: {
		'title': 'A new user registered with us.',
		'message': '{USER_NAME} registered as a {USER_TYPE} on Cravez',
		'constants': ['{USER_NAME}', '{USER_TYPE}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_BRANCH_APPROVAL_REQUEST]: {
		'title': 'Branch approval request received',
		'message': 'New branch approval request from {BRANCH_NAME} ({BRANCH_NUMBER}) {RESTAURANT_NAME}.',
		'constants': ['{BRANCH_NAME}', '{BRANCH_NUMBER}', '{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_BRANCH_APPROVAL_REQUEST_STATUS_UPDATE]: {
		'title': 'Branch approval request status update',
		'message': 'Branch approval request of {BRANCH_NAME} ({BRANCH_NUMBER}) {RESTAURANT_NAME} has been {STATUS_NAME}.',
		'constants': ['{BRANCH_NAME}', '{BRANCH_NUMBER}', '{RESTAURANT_NAME}', '{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_ENQUIRY_REQUEST]: {
		'title': 'New restaurant enquiry request received',
		'message': 'New restaurant enquiry request from {RESTAURANT_NAME}.',
		'constants': ['{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST]: {
		'title': 'New restaurant category approval request received',
		'message': 'New restaurant category {CATEGORY_NAME} approval request from {RESTAURANT_NAME}.',
		'constants': ['{CATEGORY_NAME}', '{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST_STATUS_UPDATE]: {
		'title': 'Restaurant category approval status changed',
		'message': 'Approval request of {CATEGORY_NAME} {RESTAURANT_NAME} has been {STATUS_NAME}.',
		'constants': ['{CATEGORY_NAME}', '{RESTAURANT_NAME}', '{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST]: {
		'title': 'New restaurant menu approval request received',
		'message': 'New restaurant menu {MENU_NAME} approval request from {RESTAURANT_NAME}.',
		'constants': ['{MENU_NAME}', '{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST_STATUS_UPDATE]: {
		'title': 'Restaurant menu approval status changed',
		'message': 'Approval request of {MENU_NAME} {RESTAURANT_NAME} has been {STATUS_NAME}.',
		'constants': ['{MENU_NAME}', '{RESTAURANT_NAME}', '{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TICKET_ASSIGNED]: {
		'title': 'Ticket assigned',
		'message': 'New ticket has been assigned to you, Click to see details.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TICKET_REOPENED_AND_ASSIGNED]: {
		'title': 'Ticket reopened',
		'message': '1 of your closed ticket is Reopened, Click to see details.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_OVERTIME_REQUEST]: {
		'title': 'New Overtime Request',
		'message': '{TL_FULL_NAME} added a new overtime request for you.',
		'constants': ['{TL_FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_VACATION_REQUEST]: {
		'title': 'New Vacation Request',
		'message': '{TL_FULL_NAME} added a new vacation request on your behalf.',
		'constants': ['{TL_FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_WEEKLY_REQUEST]: {
		'title': 'New Weekly Request',
		'message': '{TL_FULL_NAME} added a new weekly request on your behalf.',
		'constants': ['{TL_FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TEAM_BREAK_REQUEST_POST]: {
		'title': 'New Team Break Request Posted',
		'message': '{FULL_NAME} posted a new team break request.',
		'constants': ['{FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TEAM_BREAK_APPROVE_REJECT]: {
		'title': 'Team Break approved/disapproved',
		'message': 'Team break request has been {STATUS_NAME}.',
		'constants': ['{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_CUISINE_PRIORITIES_SEND_FOR_APPROVAL]: {
		'title': 'Cuisine priorities approval request received',
		'message': 'New cuisine priority request received for {BRANCH_NAME}.',
		'constants': ['{BRANCH_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_CUISINE_PRIORITIES_REJECTED]: {
		'title': 'Cuisine priorities has been rejected. ',
		'message': 'Cuisine priorities has been rejected by {RESTAURANT_NAME}.',
		'constants': ['{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_CUISINE_PRIORITIES_APPROVED]: {
		'title': 'Cuisine priorities has been approved. ',
		'message': 'Cuisine priorities has been approved by {RESTAURANT_NAME}.',
		'constants': ['{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST_STATUS_UPDATE]: {
		'title': 'Restaurant item approval status changed',
		'message': 'Approval request of {ITEM_NAME} item has been {STATUS_NAME}.',
		'constants': ['{ITEM_NAME}', '{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST]: {
		'title': 'New restaurant item approval request received',
		'message': 'New item {ITEM_NAME} approval request from {RESTAURANT_NAME}.',
		'constants': ['{ITEM_NAME}', '{RESTAURANT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_BREAK_REQUEST_POST]: {
		'title': 'New Driver Break Request Posted',
		'message': '{FULL_NAME} posted a new driver break request.',
		'constants': ['{FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_BREAK_APPROVE_REJECT]: {
		'title': 'Driver Break approved/disapproved',
		'message': 'Your break request has been {STATUS_NAME}.',
		'constants': ['{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_EXCUSES_REQUEST_POST]: {
		'title': 'New Driver Excuse Request Posted',
		'message': '{FULL_NAME} posted a new driver excuse request.',
		'constants': ['{FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_EXCUSES_APPROVE_REJECT]: {
		'title': 'Driver Excuse approved/disapproved',
		'message': 'Your excuse request has been {STATUS_NAME}.',
		'constants': ['{STATUS_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ADD_IN_WALLET]: {
		'title': 'Amount add in wallet.',
		'message': '{AMOUNT} amount has been added in your account.',
		'constants': ['{AMOUNT}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_PENDING]: {
		'title': 'New order placed.',
		'message': 'New Order {ORDER_ID} has been placed. Please review',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_PREPARING]: {
		'title': 'Order is preparing.',
		'message': 'Order {ORDER_ID} is accepted.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_READY_TO_PICK_UP]: {
		'title': 'Order is ready to pick up.',
		'message': 'Order {ORDER_ID} is ready to pick up.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TO_DRIVER_ORDER_READY_TO_PICK_UP]: {
		'title': 'Order is ready to pick up.',
		'message': 'Order {ORDER_ID} is ready to pick up. Go fast to catch the order',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_ON_THE_WAY]: {
		'title': 'Order is out for delivery.',
		'message': 'Order {ORDER_ID} is picked up.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_REJECTED]: {
		'title': 'Order Rejected.',
		'message': 'Order {ORDER_ID} is rejected.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_CANCELLED]: {
		'title': 'Order Cancelled.',
		'message': 'Order {ORDER_ID} is cancelled.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_CANCELLED_TO_DRIVER]: {
		'title': 'Order Cancelled.',
		'message': 'Order {ORDER_ID} is cancelled',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_DELIVERED]: {
		'title': 'Order Delivered.',
		'message': 'Order {ORDER_ID} is delivered.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_MODIFIED]: {
		'title': 'Order Modified.',
		'message': 'A order {ORDER_ID} is modified.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_CONFIRMED]: {
		'title': 'Order confirmed.',
		'message': 'New Order {ORDER_ID} has been placed. Please review',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_ACCEPTED_ORDER]: {
		'title': 'Order Accepted.',
		'message': 'Captain is assigned for the Order {ORDER_ID}. He is on his way.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_ARRIVED_ORDER]: {
		'title': 'Order Accepted.',
		'message': 'Captain is arrived for the order {ORDER_ID} at restaurant.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION]: {
		'title': 'Order Arrived.',
		'message': 'Captain  is arrived at customer location for order {ORDER_ID}.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_WAY_AT_CUSTOMER_LOCATION]: {
		'title': 'Order is out for delivery.',
		'message': 'Captain  is on the way to customer location for order {ORDER_ID}.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_ASSIGNED_ORDER]: {
		'title': 'Order Assigned.',
		'message': 'New Order {ORDER_ID} is assigned to you.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_CAPTAIN_OVERTIME_REQUEST]: {
		'title': 'New Overtime Request',
		'message': '{TL_FULL_NAME} requested you {HOURS} hours overtime on {DATE}.',
		'constants': ['{TL_FULL_NAME}', '{HOURS}', '{DATE}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TRANSFER_BALANCE]: {
		'title': 'A transfer amount received.',
		'message': 'You have received a transfer balance of {AMOUNT} will be added to your wallet from {MOBILE_NUMBER}',
		'constants': ['{AMOUNT}', '{MOBILE_NUMBER}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_PURCHASE_PACKAGE]: {
		'title': 'A package purchased.',
		'message': 'You have received a purchase package of {AMOUNT}.',
		'constants': ['{AMOUNT}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_PURCHASE_PACKAGE_STATUS]: {
		'title': 'A package purchased.',
		'message': 'You package purchase request has been {STATUS}.',
		'constants': ['{STATUS}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_SEND_TO_USERS_ORDER_REMIND]: {
		'title': 'You have not placed any order.',
		'message': 'You have not placed any order for last {DAY} days, Please take a moment and fill a survey to help us serve you better.',
		'constants': ['{DAY}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER]: {
		'title': 'Order Amount Overdue',
		'message': 'Please pay outstanding amount of {AMOUNT} for your updated order {ORDER_ID}.',
		'constants': ['{AMOUNT}', '{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TO_GUEST_FOR_EXCEEDED_ORDER_LIMIT]: {
		'title': 'Order limit as guest',
		'message': 'You have placed ' + GUEST_USER_ORDER_LIMIT + ' order successfully. Please register as user for next order.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_PROBLEMATIC]: {
		'title': 'Order problematic',
		'message': 'Due to some reason your order {ORDER_ID} has been delayed.',
		'constants': ['{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_BREAK_CANCEL]: {
		'title': 'Driver Break cancelled',
		'message': 'Your break request has been cancelled.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_BREAK_ADD]: {
		'title': 'New Driver Break Added.',
		'message': 'Hello {FULL_NAME}, administration added a new break.',
		'constants': ['{FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_EXCUSES_CANCEL]: {
		'title': 'Driver Excuse cancelled.',
		'message': 'Your excuse request has been cancelled.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_OUTSTANDING_AMOUNT_PAID]: {
		'title': 'Order Outstanding amount paid',
		'message': 'Outstanding amount of {AMOUNT} for updated order {ORDER_ID} has been paid successfully.',
		'constants': ['{AMOUNT}', '{ORDER_ID}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_BREAK_END]: {
		'title': 'Driver Break Ended.',
		'message': 'Hello {FULL_NAME},  administration have ended your break.',
		'constants': ['{FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_SCHEDULED_PUSH_NOTIFICATION]: {
		'title': '{TITLE}',
		'message': '{MESSAGE}',
		'constants': ['{TITLE}', '{MESSAGE}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ADD_WALLET_AMOUNT]: {
		'title': 'Amount added in wallet',
		'message': '{AMOUNT} amount has been added in your wallet as {WALLET_TYPE}.',
		'constants': ['{WALLET_TYPE}', '{AMOUNT}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_DRIVER_BREAK_ENDED]: {
		'title': 'Driver Break Ended',
		'message': '{FULL_NAME} has ended break.',
		'constants': ['{FULL_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_ORDER_DELAY_VOC_PN]: {
		'title': 'Driver Delayed',
		'message': 'Your order from {RESTAURANT} is seems to be delayed.',
		'constants': ['{RESTAURANT}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_SHIFT_NOT_JOIN_PN_DRIVER]: {
		'title': 'Shift Not Joined',
		'message': 'Your shift has started at {SHIFT_TIME}. Please join it.',
		'constants': ['{SHIFT_TIME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_SHIFT_NOT_JOIN_PN_CRAVEZ]: {
		'title': 'Shift Not Joined',
		'message': 'Captain {DRIVER_NAME} did not joined {SHIFT_NAME}.',
		'constants': ['{DRIVER_NAME}', '{SHIFT_NAME}'],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_BREAK_EXCUSE_IMMEDIATELY_CANCELED]: {
		'title': 'Administration cancel excuses and breaks',
		'message': 'Administration has been cancelled excuses and breaks.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
	[NOTIFICATION_TO_DRIVER_LOGIN_IN_ANOTHER_DEVICE]: {
		'title': 'Login In Another Device',
		'message': 'It seems you are logged in on another device.',
		'constants': [],
		'icon_class': 'bg-light-green',
		'icon': 'notifications_active'
	},
};

/* Validations limit */
export const MAX_CHARACTER_ALLOWED_IN_LISTING = 200;
export const DEFAULT_RANDOM_NUMBER_LENGTH = 6;

/** Search Status for pn logs **/
export const SEARCHING_ANDROID = "Android";
export const SEARCHING_IPHONE = "iPhone";

/** Search status for pn logs **/
export const PN_LOGS_DEVICE_TYPE_SEARCH_DROPDOWN = [
	{ device_id: SEARCHING_ANDROID, device_name: "Android" },
	{ device_id: SEARCHING_IPHONE, device_name: "iPhone" },
];
/* Bcrypt password limit */
export const BCRYPT_PASSWORD_SALT_ROUNDS = 10;

/* Default country ID */
export const COUNTRY_ID = 414;
/* Modules name */
export const MODULE_TYPE_ADMIN = "admin";
export const MODULE_TYPE_RESTAURANT = "restaurant";

/* Admin user types name */
export const USER_TYPE_ADMIN = "admin";
export const USER_TYPE_RESTAURANT = "restaurant";
export const USER_TYPE_DRIVER = "driver";
export const USER_TYPE_CUSTOMER = "customer";
export const USER_TYPE_OTHER = "other";

/** Commission type  */
export const COMMISSION_FIXED = "fixed";
export const COMMISSION_VARIABLE = "variable";
export const COMMISSION_FIXED_AMOUNT = "fixed_amount";

/** Commission type object  */
export const COMMISSION_TYPE_OBJECT = {
	[COMMISSION_FIXED]: "Fixed",
	[COMMISSION_VARIABLE]: "Variable",
	[COMMISSION_FIXED_AMOUNT]: "Fixed Amount",
};

/** Commission criteria  */
export const NET_AMOUNT = "net_amount";
export const GROSS_AMOUNT = "gross_amount";

/** Commission criteria object  */
export const COMMISSION_CRITERIA_OBJECT = {
	[NET_AMOUNT]: "Net Amount",
	[GROSS_AMOUNT]: "Gross Amount",
};

/** Compensation caused by */
export const CAUSED_BY_CUSTOMER = "customer";
export const CAUSED_BY_RESTAURANT = "restaurant";
export const CAUSED_BY_CRV = "crv";

/** Compensation caused by object  */
export const CAUSED_BY_OBJECT = {
	[CAUSED_BY_CUSTOMER]: "Customer",
	[CAUSED_BY_RESTAURANT]: "Restaurant",
	[CAUSED_BY_CRV]: "CRV",
};

/** Settlement Type */
export const DAILY_SETTLEMENT = "daily";
export const WEEKLY_SETTLEMENT = "weekly";
export const MONTHLY_SETTLEMENT = "monthly";
export const ON_DEMAND = "on_demand";

/** Compensation caused by object  */
export const SETTLEMENT_TYPE_OBJECT = {
	[DAILY_SETTLEMENT]: "Daily",
	[WEEKLY_SETTLEMENT]: "Weekly",
	[MONTHLY_SETTLEMENT]: "Monthly",
	[ON_DEMAND]: "OnDemand",
};

/**For forgot password */
export const EMAIL = "email"
export const MOBILE_NUMBER = "mobile_number"

export const EMAIL_PHONE_DROPDOWN = {
	[EMAIL]: "Email",
	[MOBILE_NUMBER]: "Mobile Number",
};

/* Restaurant description limit */
export const RESTAURANT_DESCRIPTION_MAX_LENGTH = 150;

/** User activity */
export const ACTIVITY_DELETE_DETAILS = "delete-details";
export const ACTIVITY_UPDATE_STATUS = "update-status";
export const ACTIVITY_ADD_EDIT_DETAILS = "add-edit-details";
export const ACTIVITY_CLONE_DETAILS = "clone-details";
export const ACTIVITY_APPROVE_RESTAURANT = "approve-restaurant";
export const ACTIVITY_UPDATE_RESTAURANT_DETAILS = "update-restaurant-details";
export const ACTIVITY_SEND_RESTAURANT_BRANCH_FOR_APPROVAL = "restaurant-branch-approval-request";
export const ACTIVITY_SEND_ITEM_FOR_APPROVAL = "item-approval-request";
export const ACTIVITY_ADD_RECOMMENDED_ITEM = "add-recommended-item";
export const ACTIVITY_ADD_UPSELLING_ITEM = "add-upselling-item";

/** Calendar Status */
export const CALENDAR_STATUS = [
	{ status_id: OPEN, status_name: "Open" },
	{ status_id: CLOSE, status_name: "Close" }
];

/** Calendar open status type **/
export const DEFAULT_WEEK = "DW";

export const OPEN_STATUS = {
	[DEFAULT_WEEK]: { title: 'Every Day', description: 'Default Week `Every Day`' }
};

/** Calendar close status type **/
export const WEEK_DAY = "WD";
export const SPECIAL_DAY_OF_WEEK = "SW";

export const CLOSE_STATUS = {
	[WEEK_DAY]: { title: 'Week Day', description: 'Week Day' },
};

/* Calendar days */
export const MONDAY = 1;
export const TUESDAY = 2;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;
export const SUNDAY = 7;

export const DAY_LIST = {
	[SUNDAY]: 'Sunday',
	[MONDAY]: 'Monday',
	[TUESDAY]: 'Tuesday',
	[WEDNESDAY]: 'Wednesday',
	[THURSDAY]: 'Thursday',
	[FRIDAY]: 'Friday',
	[SATURDAY]: 'Saturday',
};

/**Rejection message length */
export const REJECTION_MESSAGE_TEXT_LENGTH = 200;

/** Schedule notification types */
export const NOTIFICATION_TYPE_EMAIL = "email";
export const NOTIFICATION_TYPE_SMS = "sms";
export const NOTIFICATION_TYPE_NOTIFICATION = "notifications";

/**Email events */
export const USER_REGISTRATION_EMAIL_EVENTS = "user_registration";
export const BRANCH_ENQUIRY_REJECT_EMAIL_EVENTS = "branch_enquiry_reject";
export const BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS = "branch_enquiry_approve";
export const RESTAURANT_ENQUIRY_REQUEST_EMAIL_EVENTS = "restaurant_enquiry_request";
export const RESTAURANT_ENQUIRY_REJECT_EMAIL_EVENTS = "restaurant_enquiry_reject";
export const RESTAURANT_ENQUIRY_APPROVE_EMAIL_EVENTS = "restaurant_enquiry_approve";
export const TEAM_BREAK_APPROVE_REJECT_EMAIL_EVENTS = "team_break_approve_reject";
export const TEAM_BREAK_REQUEST_POSTED_EMAIL_EVENTS = "team_break_request";
export const RESTAURANT_CATEGORY_APPROVE_EMAIL_EVENTS = "restaurant_category_approve";
export const RESTAURANT_CATEGORY_REJECT_EMAIL_EVENTS = "restaurant_category_reject";
export const RESTAURANT_MENU_REJECT_EMAIL_EVENTS = "restaurant_menu_reject";
export const RESTAURANT_MENU_APPROVE_EMAIL_EVENTS = "restaurant_menu_approve";
export const RESTAURANT_REGISTRATION_EMAIL_EVENTS = "restaurant_registration";
export const RESEND_CUSTOMER_DRIVER_EMAIL_EVENTS = "resend_verification_mail";
export const CUSTOMER_DRIVER_FORGOT_PASSWORD_EMAIL_EVENTS = "customer_driver_forgot_password";
export const RESTAURANT_ITEM_APPROVE_EMAIL_EVENTS = "restaurant_item_approve";
export const RESTAURANT_ITEM_REJECT_EMAIL_EVENTS = "restaurant_item_reject";
export const DRIVER_BREAK_APPROVE_REJECT_EMAIL_EVENTS = "driver_break_approve_reject";
export const DRIVER_BREAK_REQUEST_POSTED_EMAIL_EVENTS = "driver_break_request";
export const DRIVER_BREAK_REQUEST_ENDED_EMAIL_EVENTS = "driver_break_ended";
export const DRIVER_EXCUSES_REQUEST_POSTED_EMAIL_EVENTS = "driver_excuse_request";
export const DRIVER_EXCUSE_APPROVE_REJECT_EMAIL_EVENTS = "driver_excuse_approve_reject";
export const CUSTOMER_SEND_OTP_EMAIL_EVENTS = "send_otp";
export const ADD_IN_WALLET_EMAIL_EVENTS = "add_in_wallet";
export const ORDER_STATUS_PENDING_EVENT = "order_status_pending";
export const ORDER_STATUS_PREPARING_EVENT = "order_status_preparing";
export const ORDER_STATUS_READY_TO_PICK_UP_EVENT = "order_status_ready_to_pick_up";
export const ORDER_STATUS_ON_THE_WAY_EVENT = "order_status_on_the_way";
export const ORDER_STATUS_DELIVERED_EVENT = "order_status_delivered";
export const ORDER_STATUS_REJECTED_EVENT = "order_status_rejected";
export const CORPORATE_REGISTRATION_EVENT = "corporate_registration_event";
export const ORDER_STATUS_MODIFIED_EVENT = "order_status_pending_modified";
export const ORDER_STATUS_CONFIRMED_EVENT = "order_status_confirmed";
export const ORDER_STATUS_CANCELLED_EVENT = "order_status_cancelled";
export const ORDER_STATUS_DRIVER_ACCEPTED_EVENT = "order_status_driver_accepted";
export const ORDER_STATUS_DRIVER_ASSIGNED_EVENT = "order_status_driver_assigned";
export const ORDER_STATUS_DRIVER_WAY_TO_CUSTOMER_EVENT = "order_status_driver_way_to_customer_location";
export const ORDER_STATUS_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION_EVENT = "order_status_driver_arrived_at_customer_location";
export const PACKAGE_PURCHASE_MAIL = "purchase_package_event";
export const PACKAGE_ACCEPT_MAIL = "package_accept_event";
export const USER_CONTACT_US_EVENTS = "contact_us";
export const ORDER_STATUS_PROBLEMATIC_EVENT = "order_status_problematic";
export const DRIVER_BREAK_CANCEL_EMAIL_EVENTS = "driver_break_cancel";
export const DRIVER_BREAK_ADD_EMAIL_EVENTS = "driver_break_add";
export const DRIVER_EXCUSE_CANCEL_EMAIL_EVENTS = "driver_excuse_cancel";
export const DRIVER_BREAK_END_EMAIL_EVENTS = "driver_break_end";
export const DRIVER_BREAK_EXCUSE_IMMEDIATELY_CANCELED = "driver_break_excuse_cancel";

/** Email Events Type Configuration */
export const EMAIL_EVENTS = {
	[BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS]: {
		notification_types: [NOTIFICATION_TYPE_EMAIL, NOTIFICATION_TYPE_NOTIFICATION]
	},
};

/** Delivery attribute id */
export const DELIVERY_ATTRIBUTE_ID = 44;
export const PREPARATION_TIME_ATTRIBUTE_ID = 40;
export const DELIVERY_DURATION_ATTRIBUTE_ID = 39;
export const MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID = 41;
export const DELIVERY_FEES_ATTRIBUTE_ID = 43;
export const ACCEPT_SCHEDULING_ATTRIBUTE_ID = 65;
export const HAS_OFFERS_ATTRIBUTE_ID = 59;
export const ACCEPT_PICKUP_ORDER = 60;
export const TRENDS_ATTRIBUTE_ID = 74;
export const MORNING_PROFILE_ATTRIBUTE_ID = 81;
export const EVENING_PROFILE_ATTRIBUTE_ID = 82;
export const DELIVERY_VEHICLE_TYPE_ATTRIBUTE_ID = 83;
export const DRIVER_SELECTION_TYPE_ATTRIBUTE_ID = 84;
export const SLOGAN_ENGLISH_ATTRIBUTE_ID = 10;
export const SLOGAN_ARABIC_ATTRIBUTE_ID = 11;
export const BRANCH_ACCEPTS_CASHBACK_PAYMENT_ATTRIBUTE_ID = 12;
export const BRANCH_ADDITIONAL_TAX_ATTRIBUTE_ID = 19;
export const BRANCH_EXTRA_CHARGE_BY_VALUE_ATTRIBUTE_ID = 18;
export const BRANCH_DISCOUNT_BY_VALUE_ATTRIBUTE_ID = 20;
export const BRANCH_DISCOUNT_BY_PERCENTAGE_ATTRIBUTE_ID = 13;
export const BRANCH_EXTRA_CHARGE_PERCENTAGE_ATTRIBUTE_ID = 23;
export const BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID = 30;
export const BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID = 22;
export const BRANCH_ACCEPTS_CASHBACK_FROM_OTHER_RESTAURANT_ATTRIBUTE_ID = 80;
export const BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID = 1;
export const MAXIMUM_DURATION_IN_DAYS_FOR_SCHEDULED_ORDERS_ATTRIBUTE_ID = 25;

/* Branch los status */
export const BRANCH_LOG_STATUS = {
	[PENDING]: "Send For Approval",
	[IN_REVIEW]: "In Review",
	[APPROVED]: "Approved",
	[REJECTED]: "Disapproved",
};

/** User common conditions */
export const FRONT_USER_COMMON_CONDITIONS = {
	user_type: USER_TYPE_RESTAURANT,
	is_deleted: NOT_DELETED,
	active: ACTIVE,
};

/** Admin user common conditions */
export const ADMIN_USER_COMMON_CONDITIONS = {
	user_type: USER_TYPE_ADMIN,
	is_deleted: NOT_DELETED,
	active: ACTIVE,
};

/** Customer common conditions */
export const CUSTOMER_COMMON_CONDITIONS = {
	user_role_id: CUSTOMER,
	is_deleted: NOT_DELETED,
	user_type: USER_TYPE_OTHER,
	active: ACTIVE,
};

/** Driver common conditions */
export const DRIVER_COMMON_CONDITIONS = {
	user_role_id: DRIVER,
	is_deleted: NOT_DELETED,
	user_type: USER_TYPE_OTHER,
	active: ACTIVE,
};

/** Driver assignment common conditions */
export const DRIVER_ASSIGNMENT_CONDITIONS = {
	user_role_id: DRIVER,
	is_deleted: NOT_DELETED,
	user_type: USER_TYPE_OTHER,
	active: ACTIVE,
	is_online: ONLINE,
	is_available: AVAILABLE,
	vehicle_id: { $exists: true },
	vehicle_type: { $exists: true },
	is_suspend: { $ne: SUSPEND },
};

/** platform select box used in email template **/
export const PLATFORM_SMS = "sms";
export const PLATFORM_EMAIL = "email";
export const PLATFORM = {
	[PLATFORM_SMS] : "SMS",
	[PLATFORM_EMAIL] : "Email",
};

/** Global Constant for leaves */
export const ANNUAL = 1;
export const CASUAL = 2;
export const SICK = 3;
export const WEEKLY_OFF = 78;
export const ANNUAL_LEAVE = 74;
export const CASUAL_LEAVE = 75;
export const SICK_LEAVE = 76;
export const PAID_LEAVE = 79;

export const LEAVE_TYPES = {
	[ANNUAL] : "Annual Leave",
	[CASUAL] : "Casual Leave",
	[SICK] : "Sick Leave",
	[WEEKLY_OFF] : "Weekly Off"
};

export const VACATION_LEAVE_TYPES = {
	[ANNUAL] : "Annual Leave",
	[CASUAL] : "Casual Leave",
	[SICK] : "Sick Leave",
};

/** Global Constant for leave frequency  */
export const MONTHLY = 1;
export const QUATERLY = 2;
export const HALF_YEARLY = 3;

export const FREQUENCY = {
	[MONTHLY] : "Monthly",
	[QUATERLY] : "Quarterly",
	[HALF_YEARLY] : "Half Yearly",
};

/** Frequency month list */
export const FIRST_MONTH_NAME = "1";
export const FREQUENCY_MONTH_LIST = {
	[MONTHLY] : [FIRST_MONTH_NAME, "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
	[QUATERLY] : [FIRST_MONTH_NAME, "4", "7", "10"],
	[HALF_YEARLY] : [FIRST_MONTH_NAME, "7"],
};

/** Search status for global section **/
export const LEAVE_REQUEST_STATUS = {
	[PENDING] : { status_name: "Pending", label_class: "label-success" },
	[TAKEN] : { status_name: "Taken", label_class: "label-danger" },
};

/** Status for branch **/
export const BRANCH_ACTIVE = 1;
export const BRANCH_DEACTIVE = 2;
export const BRANCH_BUSY = 3;
export const BRANCH_OPEN = 4;
export const BRANCH_FEATURED = 5;
export const BRANCH_UNFEATURED = 6;

/** Default permission for front */
export const FRONT_ALLOWED_PERMISSIONS = [
	FRONT_END_NAME + "dashboard", FRONT_END_NAME + "edit_profile", FRONT_END_NAME + "change_password", FRONT_END_NAME + "notifications/get_header_notifications", FRONT_END_NAME + "notifications/get_header_notifications_counter", FRONT_END_NAME + "notifications"
];

/** Default permission for admin */
export const ADMIN_ALLOWED_PERMISSIONS = [
	"/" + ADMIN_NAME + "/dashboard", "/" + ADMIN_NAME + "/dashboard/agent_login", "/" + ADMIN_NAME + "/dashboard/agent_login/get_agent_login_detail", "/" + ADMIN_NAME + "/edit_profile", "/" + ADMIN_NAME + "/notifications/get_header_notifications", "/" + ADMIN_NAME + "/notifications/get_header_notifications_counter", "/" + ADMIN_NAME + "/notifications"
];

/** Ticket Type */
export const EXTERNAL_TICKET = 1;
export const INTERNAL_TICKET = 2;
export const TICKET_TYPE = {
	[EXTERNAL_TICKET] : "External",
	[INTERNAL_TICKET] : "Internal",
};

/** Ticket Status */
export const TICKET_OPEN = 1;
export const TICKET_CLOSE = 2;
export const TICKET_REOPENED = 3;
export const TICKET_RESPONDED_STATUS = 4;

export const TICKET_STATUS = {
	[PENDING] : "Pending",
	[TICKET_OPEN] : "Open",
	[TICKET_CLOSE] : "Close",
	[TICKET_REOPENED] : "Reopen",
};

/** For ticket status in restaurant dropdown*/
export const TICKET_RESTAURANT_STATUS = {
	[TICKET_OPEN] : { status_name: "Open", label_class: "label-primary" },
	[TICKET_CLOSE] : { status_name: "Closed", label_class: "label-danger" },
	[TICKET_RESPONDED_STATUS] : { status_name: "Responded", label_class: "label-success" },
	[PENDING] : { status_name: "Pending", class: "label-warning" },
};

/**Ticket Activity type */
export const TICKET_ASSIGNED = 1;
export const TICKET_RESPONDED = 2;
export const TICKET_CLOSED = 3;
export const TICKET_CHECKIN = 4;
export const TICKET_REOPENED_ACTIVITY = 5;
export const TICKET_REVIEW_ACTIVITY = 6;
export const TICKET_UPDATE = 7;
export const TICKET_PENDING = 8;

export const TICKET_ACTIVITY_TYPE = {
	[TICKET_ASSIGNED] : "Assigned",
	[TICKET_RESPONDED] : "Responded",
	[TICKET_CLOSED] : "Closed",
	[TICKET_CHECKIN] : "Check-In",
	[TICKET_REOPENED_ACTIVITY] : "Reopen",
	[TICKET_REVIEW_ACTIVITY] : "Review",
	[TICKET_UPDATE] : "Ticket Update",
};

/** Ticket Log type */
export const TICKET_ASSIGNED_LOG = 1;
export const TICKET_REASSIGNED_LOG = 2;
export const TICKET_CLOSED_LOG = 3;
export const TICKET_CHECKIN_LOG = 4;
export const TICKET_REOPENED_LOG = 5;
export const TICKET_REVIEW_LOG = 6;
export const TICKET_COMMENT_LOG = 7;
export const TICKET_UPDATE_LOG = 8;

export const TICKET_LOG_MESSAGE = {
	[TICKET_ASSIGNED_LOG] : {
		'message': '{USER_NAME}({USER_DEPARTMENT}) assigned ticket to {DEPARTMENT}.',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}', '{DEPARTMENT}'],
	},
	[TICKET_REASSIGNED_LOG] : {
		'message': '{USER_NAME}({USER_DEPARTMENT}) has reassigned ticket to {DEPARTMENT}.',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}', '{DEPARTMENT}'],
	},
	[TICKET_CLOSED_LOG] : {
		'message': '{USER_NAME}({USER_DEPARTMENT}) has close ticket.',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}', '{TICKET_NUMBER}'],
	},
	[TICKET_CHECKIN_LOG] : {
		'message': 'Ticket has check-in by {USER_NAME}({USER_DEPARTMENT}).',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}'],
	},
	[TICKET_REOPENED_LOG] : {
		'message': 'Ticket has reopen and assigned to {DEPARTMENT} by {USER_NAME}({USER_DEPARTMENT}).',
		'constants': ['{DEPARTMENT}', '{USER_NAME}', '{USER_DEPARTMENT}'],
	},
	[TICKET_REVIEW_LOG] : {
		'message': '{USER_NAME}({USER_DEPARTMENT}) has post review on ticket. \n Rating : {TICKET_RATING} \n Comment : {TICKET_COMMENT}',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}', '{TICKET_RATING}', '{TICKET_COMMENT}'],
	},
	[TICKET_COMMENT_LOG] : {
		'message': '{USER_NAME}({USER_DEPARTMENT}) has posted a comment.',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}'],
	},
	[TICKET_UPDATE_LOG] : {
		'message': 'Ticket has updated by {USER_NAME}({USER_DEPARTMENT}).',
		'constants': ['{USER_NAME}', '{USER_DEPARTMENT}'],
	},
};

/**Ticket category allowed user roles */
export const TICKET_CATEGORY_ALLOWED_ROLES = [QA_TEAM, CALL_CENTER_TEAM];

/**For instance */
export const HOME_PAGE = "home-page";
export const REGISTRATION = "registration";
export const SURVEY_AFTER_FIRST_ORDER = "after_first_order";
export const SURVEY_FOR_CLIENT_IF_NO_ORDER_PLACED = "if_no_order_placed";
export const SURVEY_FOR_CLIENT_IF_NO_ORDER_PLACED_FOR_LONG_TIME = "if_no_order_placed_for_long_time";

export const INSTANCE = {
	[SURVEY_AFTER_FIRST_ORDER] : "After First Order",
	[SURVEY_FOR_CLIENT_IF_NO_ORDER_PLACED] : "If no order placed",
	[SURVEY_FOR_CLIENT_IF_NO_ORDER_PLACED_FOR_LONG_TIME] : "If no order placed from long time",
};

/* Import manager sample file */
export const IMPORT_MANAGER_SAMPLE_FILE_PATH = WEBSITE_PUBLIC_UPLOADS_PATH + "sample_files/import_sample_file.xlsx";

/**Used in merchant upload section */
export const MERCHANT_UPLOAD_CATEGORY = "upload_category";
export const MERCHANT_UPLOAD_MAIN_CATEGORY = "upload_main_category";
export const MERCHANT_UPLOAD_BRANCHES = "upload_branches";
export const MERCHANT_UPLOAD_BRANCH_AREAS = "upload_branch_areas";
export const MERCHANT_UPLOAD_ITEM_CHOICE_GROUP = "upload_item_choice_group";
export const MERCHANT_UPLOAD_ITEM_EXTRA_ITEMS = "upload_item_extra_items";
export const MERCHANT_UPLOAD_ITEM = "upload_item";
export const MERCHANT_UPLOAD_MENU = "upload_menu";
export const MERCHANT_UPLOAD_RESTAURANT = "upload_restaurant";

export const MERCHANT_UPLOAD_ACTION = {
	[MERCHANT_UPLOAD_RESTAURANT] : {
		title: "Upload Restaurant",
		heading_columns: 11,
		select_restaurant: false,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/restaurant_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/restaurant_sample_file.csv",
	},
	[MERCHANT_UPLOAD_BRANCHES] : {
		title: "Upload Branches",
		heading_columns: 101,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/branch_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/branch_sample_file.csv",
	},
	[MERCHANT_UPLOAD_BRANCH_AREAS] : {
		title: "Upload Branch Areas",
		heading_columns: 15,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/branch_area_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/branch_area_sample_file.csv",
	},
	[MERCHANT_UPLOAD_MENU] : {
		title: "Upload Menu",
		heading_columns: 8,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/menu_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/menu_sample_file.csv",
	},
	[MERCHANT_UPLOAD_MAIN_CATEGORY] : {
		title: "Upload Cuisine",
		heading_columns: 3,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/cuisine_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/cuisine_sample_file.csv",
	},
	[MERCHANT_UPLOAD_CATEGORY] : {
		title: "Upload Category",
		heading_columns: 6,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/category_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/category_sample_file.csv",
	},
	[MERCHANT_UPLOAD_ITEM] : {
		title: "Upload Item",
		heading_columns: 58,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/item_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/item_sample_file.csv",
	},
	[MERCHANT_UPLOAD_ITEM_CHOICE_GROUP] : {
		title: "Upload Item Choices Group",
		heading_columns: 9,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/item_choice_group_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/item_choice_group_sample_file.csv",
	},
	[MERCHANT_UPLOAD_ITEM_EXTRA_ITEMS] : {
		title: "Upload Item Extra Items",
		heading_columns: 6,
		select_restaurant: true,
		sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/item_extra_items_sample_file.txt",
		csv_sample_file: MERCHANT_SAMPLE_FILE_URL + "sample_files/item_extra_items_sample_file.csv",
	},
};

export const MERCHANT_FILE_COLUMN_SEPARATOR = "~";
export const CATEGORY_DISPLAY_ORDER_REGEX = /^[1-9][0-9]*$/;

export const CATEGORY_ADD_ORDER = false;
export const CATEGORY_SELECT_BOX = true;

export const CATEGORY_TYPE_APP = "app";
export const CATEGORY_TYPE_WEB = "web";
export const CATEGORY_TYPE_MERCHANT_PORTAL = "merchant_portal";
export const CATEGORY_TYPE_CAPTAIN_APP = "captain_app";
export const CATEGORY_TYPE_UIOS_ADMIN = "uios_admin";

export const GLOBAL_CATEGORTY_DROPDOWN = {
	[CATEGORY_TYPE_MERCHANT_PORTAL] : "Merchant portal",
	[CATEGORY_TYPE_UIOS_ADMIN] : "UIOS (Admin)",
	[CATEGORY_TYPE_APP] : "Cravez Mobile App",
	[CATEGORY_TYPE_WEB] : "Cravez Web App",
	[CATEGORY_TYPE_CAPTAIN_APP] : "Captain App",
};

export const SUB_CATEGORY_BUTTON_LEVEL_TO_HIDE = 3;
export const CATEGORY_ADD_IMAGE = false;

/** For User category images file directory path and url */
export const CATEGORY_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "category/";
export const CATEGORY_URL = WEBSITE_PUBLIC_UPLOADS_PATH + "category/";

/**For pie chart */
export const SURVEY_RESPONSE_CHART_COLOR = [
	'#3366cc', '#dc3912', '#ff9900', '#109618', '#22aa99', '#743411', '#dd4477', '#990099', '#316395', '#b91383', '#6633cc', '#b82e2e', '#66aa00', '#994499', '#aaaa11', '#0099c6', '#6633cc', '#e67300', '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac', '#b77322', , '#16d620', '#b91383', '#f4359e', '#9c5935', '#a9c413', '#2a778d', '#668d1c', '#bea413', '#0c5922', '#743411'
];

/** Channels */
export const CHANNEL_MERCHANT = "merchant_portal";
export const CHANNEL_UIOS = "uios";
export const CHANNEL_CRAVEZ_MOBILE = "cravez_mobile_app";
export const CHANNEL_CRAVEZ_WEB = "cravez_web_app";
export const CHANNEL_CAPTAIN = "captain_app";
export const CHANNEL_CRON = "cron";
export const CHANNEL_SOAP = "soap";

export const SYSTEM_CHANNEL = {
	[CHANNEL_MERCHANT] : "Merchant portal",
	[CHANNEL_UIOS] : "UIOS (Admin)",
	[CHANNEL_CRAVEZ_MOBILE] : "Cravez Mobile App",
	[CHANNEL_CRAVEZ_WEB] : "Cravez Web App",
	[CHANNEL_CAPTAIN] : "Captain App",
};

/** question type radio button for question papers **/
export const SINGLE_QUESTION_TYPE = "single";
export const MULTIPLE_QUESTION_TYPE = "multiple";
export const INPUT_QUESTION_TYPE = "input";

export const QUESTION_TYPE = {
	[SINGLE_QUESTION_TYPE] : "Single",
	[MULTIPLE_QUESTION_TYPE] : "Multiple",
	[INPUT_QUESTION_TYPE] : "Input",
};

/** overtime min or max hours  **/
export const OVERTIME_MIN_HOURS = 0;
export const OVERTIME_MAX_HOURS = 24;

/**For survey management */
export const ATTEMPTED = 1;
export const SKIPPED = 0;
export const SURVEY_STATUS = {
	[ATTEMPTED] : "Attempted",
	[SKIPPED] : "Skipped",
};

export const CURRENCY_SYMBOL = "KD";

/** User referral code limit **/
export const PREFIX_MAX_LIMIT = 4;
export const TOTAL_REFERRAL_CHARACTER_LIMIT = 8;

/** Reward types */
export const REGISTRATION_REWARD = 'registration';

/**For slider management */
export const SPLASH_SCREEN = 'splash_screen';
export const SPLASH_IMAGES = 'splash_image';
export const ADS_IMAGES = 'ads_image';
export const SCREEN_TYPE = ['splash_screen', 'splash_image', 'ads_image'];

export const SLIDER_IMAGE_RESOLUTION = "1202*424";

/** User activity */
export const ACTIVITY_TYPE_ADD_EDIT = "add/edit";
export const ACTIVITY_TYPE_STATUS_UPDATE = "update-status";
export const ACTIVITY_TYPE_DELETE = "delete";
export const ACTIVITY_TYPE_ASSIGN = "assign";
export const ACTIVITY_TYPE_APPROVE = "approve";
export const ACTIVITY_TYPE_CANCELLED = "cancelled";
export const ACTIVITY_TYPE_REJECT = "reject";
export const ACTIVITY_TYPE_REQUEUE = "requeue";
export const ACTIVITY_TYPE_IMPORT_USER = "import_user";
export const ACTIVITY_TYPE_CHANGE_ADDRESS = "change_address";
export const ACTIVITY_TYPE_RESCHEDULE = "reschedule";
export const ACTIVITY_TYPE_END_BREAK = "end_break";
export const ACTIVITY_TYPE_UPDATE_ORDER_ADDRESS = "update_order_address";
export const ACTIVITY_TYPE = {
	[ACTIVITY_TYPE_ADD_EDIT] : "Add/Edit",
	[ACTIVITY_TYPE_STATUS_UPDATE] : "Update Status",
	[ACTIVITY_TYPE_DELETE] : "Delete",
	[ACTIVITY_TYPE_ASSIGN] : "Assign",
	[ACTIVITY_TYPE_APPROVE] : "Approve",
	[ACTIVITY_TYPE_CANCELLED] : "Cancelled",
	[ACTIVITY_TYPE_REJECT] : "Reject",
	[ACTIVITY_TYPE_REQUEUE] : "Requeue",
	[ACTIVITY_TYPE_IMPORT_USER] : "Import User",
	[ACTIVITY_TYPE_CHANGE_ADDRESS] : "Change Address",
	[ACTIVITY_TYPE_RESCHEDULE] : "Reschedule",
	[ACTIVITY_TYPE_END_BREAK] : "End Break",
	[ACTIVITY_TYPE_UPDATE_ORDER_ADDRESS] : "Update Order Address",
};

/** System log modules */
export const SYSTEM_LOG_MODULE_DRIVER_MANAGEMENT = "driver_management";
export const SYSTEM_LOG_MODULE_CUSTOMER_MANAGEMENT = "customer_management";
export const SYSTEM_LOG_MODULE_SLIDER_MANAGEMENT = "slider_management";
export const SYSTEM_LOG_MODULE_ROLE_MANAGEMENT = "role_management";
export const SYSTEM_LOG_MODULE_TEAM_MANAGEMENT = "team_management";
export const SYSTEM_LOG_MODULE_SETTINGS = "settings";
export const SYSTEM_LOG_MODULE_EMAIL_TEMPLATE = "email_template";
export const SYSTEM_LOG_MODULE_SUPER_PACKAGES = "super_packages";
export const SYSTEM_LOG_MODULE_CITIES = "cities";
export const SYSTEM_LOG_MODULE_AREAS = "areas";
export const SYSTEM_LOG_MODULE_AREA_BLOCKS = "area_blocks";
export const SYSTEM_LOG_MODULE_SURVEY_MANAGEMENT = "survey_management";
export const SYSTEM_LOG_MODULE_FAQ = "faq";
export const SYSTEM_LOG_MODULE_SHIFT_SETUP = "shift-setup";
export const SYSTEM_LOG_MODULE_VACATION_REQUEST = "vacation_request";
export const SYSTEM_LOG_MODULE_CMS = "cms";
export const SYSTEM_LOG_MODULE_VACATION_BALANCE = "vacation_balance";
export const SYSTEM_LOG_MODULE_WEEKLY_OFF = "weekly_off";
export const SYSTEM_LOG_MODULE_OVERTIME_REQUEST = "overtime_request";
export const SYSTEM_LOG_MODULE_CAPTAIN_OVERTIME_REQUEST = "captain_overtime_request";
export const SYSTEM_LOG_MODULE_CUISINES = "cuisines";
export const SYSTEM_LOG_MODULE_CUISINE_PRIORITIES = "cuisine priorities";
export const SYSTEM_LOG_MODULE_ATTRIBUTES = "attributes";
export const SYSTEM_LOG_MODULE_CHOICE_GROUP = "choice_group";
export const SYSTEM_LOG_MODULE_EXTRA_ITEMS = "extra_items";
export const SYSTEM_LOG_MODULE_TASK_ASSIGNMENT = "task_assignment";
export const SYSTEM_LOG_MODULE_FLEET_AREA_ASSIGNMENT = "fleet_area_assignment";
export const SYSTEM_LOG_MODULE_DRIVER_SHIFT_SETUP = "driver_shifts";
export const SYSTEM_LOG_MODULE_DRIVER_BREAKS = "driver_breaks";
export const SYSTEM_LOG_MODULE_DRIVER_EXCUSES = "driver_excuses";
export const SYSTEM_LOG_MODULE_ADD_IN_WALLET = "add_in_wallet";
export const SYSTEM_LOG_MODULE_OFFER_MANAGEMENT = "offer_management";
export const SYSTEM_LOG_MODULE_MANAGE_VEHICLE = "manage_vehicle";
export const SYSTEM_LOG_MODULE_ORDERS = "orders";
export const SYSTEM_LOG_MODULE_VOC_MANAGEMENT = "voc_management";
export const SYSTEM_LOG_MODULE_CORPORATE_TIE_UPS = "corporate_tie_ups";
export const SYSTEM_LOG_MODULE_PUSH_NOTIFICATION = "push_notifications";
export const SYSTEM_LOG_MODULE_NOTIFICATION_TYPE = "notifications_type";
export const SYSTEM_LOG_MODULE_SMS_TEMPLATE = "sms_template";
export const SYSTEM_LOG_MODULE_BANNER_MANAGEMENT = "banner_management";
export const SYSTEM_LOG_MODULE_COMPOSITE = "public_composite_offers";
export const SYSTEM_LOG_MODULE_ASSIGNMENT_SLABS = "assignment_labs";

export const SYSTEM_LOG_MODULE = {
	[SYSTEM_LOG_MODULE_DRIVER_MANAGEMENT] : "Driver Management",
	[SYSTEM_LOG_MODULE_CUSTOMER_MANAGEMENT] : "Customer Management",
	[SYSTEM_LOG_MODULE_SLIDER_MANAGEMENT] : "Slider Management",
	[SYSTEM_LOG_MODULE_ROLE_MANAGEMENT] : "Role Management",
	[SYSTEM_LOG_MODULE_TEAM_MANAGEMENT] : "Team Management",
	[SYSTEM_LOG_MODULE_SETTINGS] : "Settings",
	[SYSTEM_LOG_MODULE_EMAIL_TEMPLATE] : "Email Template",
	[SYSTEM_LOG_MODULE_SUPER_PACKAGES] : "Super Packages",
	[SYSTEM_LOG_MODULE_CITIES] : "Cities",
	[SYSTEM_LOG_MODULE_AREAS] : "Areas",
	[SYSTEM_LOG_MODULE_AREA_BLOCKS] : "Area Blocks",
	[SYSTEM_LOG_MODULE_SURVEY_MANAGEMENT] : "Survey Management",
	[SYSTEM_LOG_MODULE_FAQ] : "FAQ",
	[SYSTEM_LOG_MODULE_SHIFT_SETUP] : "Shift Setup",
	[SYSTEM_LOG_MODULE_VACATION_REQUEST] : "Vacation Request",
	[SYSTEM_LOG_MODULE_CMS] : "CMS",
	[SYSTEM_LOG_MODULE_VACATION_BALANCE] : "Vacation Balance",
	[SYSTEM_LOG_MODULE_WEEKLY_OFF] : "Weekly Off",
	[SYSTEM_LOG_MODULE_OVERTIME_REQUEST] : "Overtime Request",
	[SYSTEM_LOG_MODULE_CUISINES] : "Cuisines",
	[SYSTEM_LOG_MODULE_CUISINE_PRIORITIES] : "Cuisine Priorities",
	[SYSTEM_LOG_MODULE_ATTRIBUTES] : "Attributes",
	[SYSTEM_LOG_MODULE_EXTRA_ITEMS] : "Extra Items",
	[SYSTEM_LOG_MODULE_TASK_ASSIGNMENT] : "Task Assignment",
	[SYSTEM_LOG_MODULE_FLEET_AREA_ASSIGNMENT] : "Fleet Area Assignment",
	[SYSTEM_LOG_MODULE_DRIVER_SHIFT_SETUP] : "Driver Shifts",
	[SYSTEM_LOG_MODULE_DRIVER_BREAKS] : "Driver Breaks",
	[SYSTEM_LOG_MODULE_DRIVER_EXCUSES] : "Driver Excuses",
	[SYSTEM_LOG_MODULE_ADD_IN_WALLET] : "Add In Wallet",
	[SYSTEM_LOG_MODULE_OFFER_MANAGEMENT] : "Offer Management",
	[SYSTEM_LOG_MODULE_MANAGE_VEHICLE] : "Manage Vehicle",
	[SYSTEM_LOG_MODULE_ORDERS] : "Orders",
	[SYSTEM_LOG_MODULE_VOC_MANAGEMENT] : "VOC Management",
	[SYSTEM_LOG_MODULE_CORPORATE_TIE_UPS] : "Corporate Tie Ups",
	[SYSTEM_LOG_MODULE_PUSH_NOTIFICATION] : "Push Notifications",
	[SYSTEM_LOG_MODULE_NOTIFICATION_TYPE] : "Notifications Type",
	[SYSTEM_LOG_MODULE_SMS_TEMPLATE] : "Sms Template",
	[SYSTEM_LOG_MODULE_BANNER_MANAGEMENT] : "Banner Management",
	[SYSTEM_LOG_MODULE_COMPOSITE] : "Public Composite Offers",
	[SYSTEM_LOG_MODULE_ASSIGNMENT_SLABS] : "Assignment Slabs",
};

/**For column */
export const COLUMN_ONE = 1;
export const COLUMN_TWO = 2;
export const COLUMN_THREE = 3;
export const COLUMN_FOUR = 4;
export const COLUMN_FIVE = 5;
export const COLUMN_SIX = 6;
export const COLUMN_SEVEN = 7;
export const COLUMN_EIGHT = 8;

/** For cuisine properties */
export const CUISINE_PRIORITIES_ORDER_REGEX = /^[1-9][0-9]*$/;

/** For Cuisine Request status */
export const CUISINE_REQUEST_PENDING = 0;
export const CUISINE_REQUEST_ACCEPT = 1;
export const CUISINE_REQUEST_REJECT = 2;

export const CUISINE_REQUEST_STATUS = {
	[CUISINE_REQUEST_PENDING] : { status_name: "Pending", class: "label-warning" },
	[CUISINE_REQUEST_ACCEPT] : { status_name: "Accept", class: "label-success" },
	[CUISINE_REQUEST_REJECT] : { status_name: "Reject", class: "label-danger" },
};

/** Item Overriding options*/
export const ITEM_LISTED_TO_SELECTED_BRANCH_LIST = 1;
export const ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST = 2;
export const ITEM_CHANGED_TO_SELECTED_BRANCH_LIST = 3;

export const OVERRIDING_OPTIONS = {
	[ITEM_LISTED_TO_SELECTED_BRANCH_LIST] : "Items will only be listed to below branch list",
	[ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST] : "Items will not be listed to the below branch list",
};

/** item discount type */
export const DISCOUNT_BY_VALUE = "discount_by_value";
export const DISCOUNT_BY_PERCENTAGE = "discount_by_percentage";
export const MAX_PERCENTAGE = 100;

export const ITEM_DISCOUNT_TYPE = {
	[DISCOUNT_BY_VALUE] : "Discount By Value",
	[DISCOUNT_BY_PERCENTAGE] : "Discount By Percentage",
};

/** Item Clone options */
export const CLONE_TO_SAME_CATEGORY = 1;
export const CLONE_TO_OTHER_CATEGORY = 2;
export const CLONE_TO_OTHER_MENU = 3;

export const ITEM_CLONE_OPTIONS = {
	[CLONE_TO_SAME_CATEGORY] : "Same Category",
	[CLONE_TO_OTHER_CATEGORY] : "Other Category",
	[CLONE_TO_OTHER_MENU] : "Other Menu",
};

/** For Attributes */
export const ATTRIBUTE_INPUT_TYPES = [
	{ value: "text", title: "Text" },
	{ value: "checkbox", title: "Check Box" }
];

export const ATTRIBUTE_TYPE = [
	{ value: "branch_phones", title: "Branch phone numbers" },
	{ value: "branch_attributes", title: "Branch Attributes" }
];

export const ATTRIBUTE_VALIDATION_TYPE = [
	{ value: "text", title: "Text" },
	{ value: "percentage", title: "Percentage" },
	{ value: "numeric", title: "Numeric" },
	{ value: "float", title: "Float" }
];

export const ATTRIBUTES_REGEX = /^(0*[1-9][0-9]*)$/;

/** Delivery By constants */
export const DELIVERY_BY_RESTAURANT = "restaurant";
export const DELIVERY_BY_CRAVEZ = "cravez";
export const DELIVERY_BY_PICK_UP = "pick-up";
export const DELIVERY_BY = {
	[DELIVERY_BY_RESTAURANT] : "Restaurant",
	[DELIVERY_BY_CRAVEZ] : "Cravez",
	[DELIVERY_BY_PICK_UP] : "Pick-Up",
};
export const DELIVERY_BY_ARRAY = [DELIVERY_BY_RESTAURANT, DELIVERY_BY_CRAVEZ, DELIVERY_BY_PICK_UP];

/** Payment Methods */
export const CASH_PAYMENT = "cash";
export const WALLET_PAYMENT = "wallet";
export const KNET = "k-net";
export const CREDIT_PAYMENT = "credit";
export const MYFATOORAH = "myfatoorah";
export const MYFATOORAH_CREDIT = "myfatoorah-credit";
export const KNET_HESABE_GATEWAY = "knet-hesabe-gateway";

export const PAYMENT_METHODS = {
	[CASH_PAYMENT] : "Cash",
	[WALLET_PAYMENT] : "Wallet",
	[KNET] : "K-Net",
	[CREDIT_PAYMENT] : "Credit",
	[MYFATOORAH] : "MYFATOORAH",
	[MYFATOORAH_CREDIT] : "MYFATOORAH CREDIT",
	[KNET_HESABE_GATEWAY] : "KNet Hesabe Gateway",
};

/* to mark is_completed true*/
export const ONLINE_PAYMENT = [KNET];

/** One mile value in meter use in get miles  **/
export const ONE_MILE_IN_METER = 1609.344;

/** Driver break type */
export const IN_BREAK = "in_break";
export const END_BREAK = "end_break";
export const DRIVER_BREAK_TYPES = {
	[IN_BREAK] : "In Break",
	[END_BREAK] : "End Break",
};
export const DRIVER_BREAK_TYPE = [IN_BREAK, END_BREAK];
export const BREAK = "5df08be3517e710761353c92";

/** Restaurent slugs */
export const PIZZA_HUT = "pizza-hut";
export const BURGER_KING = "burger-king";

/** Driver break status labels **/
export const DRIVER_BREAK_STATUS = {
	[PENDING] : { status_name: "Pending", class: "label-warning" },
	[APPROVED] : { status_name: "Approved", class: "label-success" },
	[REJECTED] : { status_name: "Disapproved", class: "label-danger" },
	[CANCELLED] : { status_name: "Cancelled", class: "label-danger" },
};

/**For image trpe file in settings */
export const INPUT_FILE = "file";

/**For validate type other in settings */
export const VALIDATE_OTHER = "other";

/** Item Type */
export const NORMAL_ITEM = "normal_item";
export const NORMAL_VGROUP = "normal_vgroup";
export const COMBO_ITEM = "combo_item";
export const PIZZA_VGROUP = "pizza_vgroup";
export const DEAL_ITEM = "deal_item";
export const HALF_AND_HALF_ITEM = "half_and_half_item";

/** Driver shift type */
export const IN_SHIFT = "in_shift";
export const OUT_SHIFT = "out_shift";
export const DRIVER_SHIFT_TYPE = {
	[IN_SHIFT] : "In Shift",
	[OUT_SHIFT] : "Out Shift",
};

/** Driver excuses */
export const IN_EXCUSE = "in_excuse";
export const OUT_EXCUSE = "out_excuse";
export const CANCEL_EXCUSE = "cancel_excuse"
export const DRIVER_EXCUSE_TYPE = {
	[IN_EXCUSE] : "In Excuse",
	[OUT_EXCUSE] : "Out Excuse",
	[CANCEL_EXCUSE] : "Cancel Excuse",
};

/** Driver break status labels **/
export const DRIVER_EXCUSE_STATUS = {
	[PENDING] : { status_name: "Pending", class: "label-warning" },
	[APPROVED] : { status_name: "Approved", class: "label-success" },
	[REJECTED] : { status_name: "Disapproved", class: "label-danger" },
	[CANCELLED] : { status_name: "Cancelled", class: "label-danger" },
};

/** Cuisine properties limit */
export const CUISINE_PRIORITIES_LIMIT = 2;

/** Offer type */
export const DISCOUNT_TYPE_VALUE = "value";
export const DISCOUNT_TYPE_PERCENTAGE = "percentage";
export const DISCOUNT_TYPE = {
	[DISCOUNT_TYPE_VALUE] : "Value",
	[DISCOUNT_TYPE_PERCENTAGE] : "Percentage",
};

/** Offer Redeem type */
export const SINGLE = "single_time";
export const MULTIPLE = "multiple_time";
export const REDEEM_TYPE = {
	[SINGLE] : "Single Time",
	[MULTIPLE] : "Multiple Time",
};

/** Business rules  */
export const FIRST_ORDERS = "first_orders";
export const DUPLICATE_ORDERS = "duplicate_orders";
export const DELAYED_ORDERS = "delayed_orders";
export const TICKETING = "ticketing";
export const BIG_ORDERS = "big_orders";
export const REJECTED_ORDERS = "rejected_orders";
export const DELAYED_ACCEPTANCE = "delayed_acceptance";
export const CRAVEZ_DELIVERY_MONITORING = "cravez_delivery_monitoring";
export const RESTAURANT_DELIVERY_MONITORING = "restaurant_delivery_monitoring";
export const DELAYED_PICKUP_BY_CUSTOMER = "delayed_pickup_by_customer";
export const DELAYED_PICKUP_BY_RESTAURANT = "delayed_pickup_by_restaurant";
export const DELAYED_PICKUP_BY_CAPTAIN = "delayed_pickup_by_captain";
export const VIP_ORDERS = "vip_orders";
export const DELAYED_PREPARATION = "delayed_preparation";
export const DELAYED_IN_DELIVERY = "delayed_in_delivery";

/** Business rules object  */
export const BUSINESS_TYPE_OBJECT = {
	[FIRST_ORDERS] : "First Orders",
	[DUPLICATE_ORDERS] : "Duplicate Orders",
	[DELAYED_ORDERS] : "Delayed Orders",
	[TICKETING] : "Ticketing",
	[BIG_ORDERS] : "Big Orders",
	[REJECTED_ORDERS] : "Rejected Orders",
	[DELAYED_ACCEPTANCE] : "Delayed Acceptance",
	[CRAVEZ_DELIVERY_MONITORING] : "Cravez Delivery Monitoring",
	[RESTAURANT_DELIVERY_MONITORING] : "Restaurant Delivery Monitoring",
	[DELAYED_PICKUP_BY_CUSTOMER] : "Delayed Pickup By Customer",
	[DELAYED_PICKUP_BY_RESTAURANT] : "Delayed Pickup By Restaurant",
	[DELAYED_PICKUP_BY_CAPTAIN] : "Delayed Pickup By Captain",
	[VIP_ORDERS] : "VIP Orders",
	[DELAYED_PREPARATION] : "Delayed Preparation",
	[DELAYED_IN_DELIVERY] : "Delayed In Delivery",
};

/** Offer Applicable for */
export const APPLICABLE_FOR_GUEST = "guest";
export const APPLICABLE_FOR_REGISTERED_MEMBER = "registered_member";
export const APPLICABLE_FOR_NEW_USERS = "applicable_for_new_users_only";
export const APPLICABLE_FOR = {
	[APPLICABLE_FOR_GUEST] : "Guest",
	[APPLICABLE_FOR_REGISTERED_MEMBER] : "Register Member",
	[APPLICABLE_FOR_NEW_USERS] : "Applicable For New Users Only",
};

/** Offer type */
export const CASH_VOUCHERS = "cash_vouchers";
export const COMBO_OFFER = "combo_offers";
export const MEMBER_GUEST_OFFER = "member_guest_offers";
export const REGISTRATION_OFFER = "registration_offers";
export const CORPORATE_OFFER = "corporate_offers";
export const PUBLIC_COMPOSITE_OFFER = "public_composite_offers";
export const COUPON_WITH_MAXMIMUM_REDEMPTION_FOR_ALL_OFFER = "coupon_with_maximum_redemption_for_all";
export const COUPON_WITH_MAXMIMUM_REDEMPTION_OFFER = "coupon_with_maximum_redemption";

export const OFFER_TYPES = {
	[CASH_VOUCHERS] : "Cash Vouchers",
	[COMBO_OFFER] : "Combo Offer",
	[MEMBER_GUEST_OFFER] : "Guest Offer",
	[REGISTRATION_OFFER] : "Registration Offers",
	[CORPORATE_OFFER] : "Corporate Tie Ups Offers",
	[PUBLIC_COMPOSITE_OFFER] : "Public Composite Offers",
	[COUPON_WITH_MAXMIMUM_REDEMPTION_FOR_ALL_OFFER] : "Coupon With Maximum Redeemption For All",
	[COUPON_WITH_MAXMIMUM_REDEMPTION_OFFER] : "Coupon With Maximum Redeemption",
};

/** Item offer type */
export const ITEM_WISE_OFFER = "item_wise";
export const GENERAL_ITEM_OFFER = "general";

export const ITEM_OFFEER_TYPE = {
	[GENERAL_ITEM_OFFER] : "General",
	[ITEM_WISE_OFFER] : "Item Wise",
};

/** Multiple Redeem type */
export const USER_SPECIFIC = "user_specific";
export const GLOBAL_MULTIPLE_TYPE = "global";
export const MULTIPLE_REDEEM_TYPES = {
	[USER_SPECIFIC] : "User Specific",
	[GLOBAL_MULTIPLE_TYPE] : "Global",
};

/** Offer Redeemption limit type */
export const ONE_USER_SINGLE = "one_user_single_redeemption";
export const ONE_USER_MULTIPLE = "one_user_multiple_redeemption";
export const REDEEMPTION_LIMIT_TYPE = {
	[ONE_USER_SINGLE] : "One User Single Redeemption",
	[ONE_USER_MULTIPLE] : "One User Multiple Redeemption",
};

/**For order accept/reject status */
export const ORDER_ACCEPT = 1;
export const ORDER_REJECT = 0;

/**For order's requeue time */
export const FIRST_QUEUE_TIME = 3;
export const SECOND_QUEUE_TIME = 5;
export const THIRD_QUEUE_TIME = 10;

export const MAX_MINUTE_FOR_ORDER_CANCELED = 28;
export const ORDER_CANCELED_REASON = "Time out";

export const FIRST_REQUEUE_ORDER = 0;
export const SECOND_REQUEUE_ORDER = 1;
export const THIRD_REQUEUE_ORDER = 2;

export const QUEUE_TIME_ORDER = {
	[FIRST_REQUEUE_ORDER] : FIRST_QUEUE_TIME,
	[SECOND_REQUEUE_ORDER] : SECOND_QUEUE_TIME,
	[THIRD_REQUEUE_ORDER] : THIRD_QUEUE_TIME,
};

/* Driver order process time function for cron */
export const DRIVER_ORDER_PROCESS_TIME_IN_MINUTES = 1;

/* Order process time function response max time */
export const ORDER_PROCESS_TIME_IN_MINUTES = 5;

/* Order rule update process max time */
export const ORDER_RULE_PROCESS_TIME_IN_MINUTES = 5;

/** Order status type */
export const ORDER_PENDING = "pending";
export const ORDER_PREPARING = "preparing";
export const ORDER_REJECTED = "rejected";
export const ORDER_REJECTED_BY_ADMIN = "rejected_by_admin";/* When order is not confirmed and rejected by admin*/
export const ORDER_READY_TO_PICK_UP = "ready_to_pick_up";
export const ORDER_ON_THE_WAY = "on_the_way";
export const ORDER_ON_THE_WAY_TO_CUSTOMER = "on_the_way_to_customer";
export const ORDER_DELIVERED = "delivered";
export const ORDER_CANCELLED = "cancelled";
export const ORDER_SCHEDULED = "scheduled";
export const ORDER_CONFIRMED = "confirmed";
export const ORDER_NOT_CONFIRMED = "not_confirmed";
export const ORDER_PROBLEMATIC = "problematic";
export const ORDER_SUBMITTED = "submitted";

/** Driver order status */
export const ORDER_DRIVER_FREE = "free";
export const ORDER_DRIVER_ASSIGNED = "assigned";
export const ORDER_DRIVER_ACCEPTED = "accepted";
export const ORDER_DRIVER_PASSED = "passed";
export const ORDER_DRIVER_UNDO_ASSIGNED = "undo_assigned";
export const ORDER_DRIVER_WAY_TO_RESTAURANT = "way_to_restaurant";
export const ORDER_DRIVER_ARRIVED_AT_RESTAURANT = "arrived_at_restaurant";
export const ORDER_DRIVER_WAY_TO_CUSTOMER = "way_to_customer";
export const ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION = "arrived_at_customer_location";

/** Order Actions */
export const ORDER_ACTIONS = {
	[ORDER_PENDING] : {
		order_status: ORDER_PENDING,
		restaurant_status: ORDER_PENDING,
		customer_status: ORDER_PENDING,
		admin_status: ORDER_PENDING,
	},
	[ORDER_PREPARING] : {
		order_status: ORDER_PREPARING,
		restaurant_status: ORDER_PREPARING,
		customer_status: ORDER_PREPARING,
		admin_status: ORDER_PREPARING,
		driver_status: ORDER_PREPARING,
	},
	[ORDER_READY_TO_PICK_UP] : {
		order_status: ORDER_READY_TO_PICK_UP,
		restaurant_status: ORDER_READY_TO_PICK_UP,
		admin_status: ORDER_READY_TO_PICK_UP,
		driver_status: ORDER_READY_TO_PICK_UP,
	},
	[ORDER_ON_THE_WAY_TO_CUSTOMER] : {
		order_status: ORDER_ON_THE_WAY_TO_CUSTOMER,
		customer_status: ORDER_ON_THE_WAY_TO_CUSTOMER,
		restaurant_status: ORDER_ON_THE_WAY_TO_CUSTOMER,
		admin_status: ORDER_ON_THE_WAY_TO_CUSTOMER,
		driver_status: ORDER_ON_THE_WAY_TO_CUSTOMER,
		delivery_status: ORDER_DRIVER_WAY_TO_CUSTOMER,
	},
	[ORDER_ON_THE_WAY] : {
		order_status: ORDER_ON_THE_WAY,
		customer_status: ORDER_ON_THE_WAY,
		restaurant_status: ORDER_ON_THE_WAY,
		admin_status: ORDER_ON_THE_WAY,
		driver_status: ORDER_ON_THE_WAY,
		delivery_status: ORDER_DRIVER_WAY_TO_CUSTOMER
	},
	[ORDER_SCHEDULED] : {
		order_status: ORDER_SCHEDULED,
		restaurant_status: ORDER_SCHEDULED,
		customer_status: ORDER_SCHEDULED,
		admin_status: ORDER_SCHEDULED,
	},
	[ORDER_DELIVERED] : {
		order_status: ORDER_DELIVERED,
		restaurant_status: ORDER_DELIVERED,
		customer_status: ORDER_DELIVERED,
		admin_status: ORDER_DELIVERED,
		driver_status: ORDER_DELIVERED,
		delivery_status: ORDER_DELIVERED,
	},
	[ORDER_CANCELLED] : {
		order_status: ORDER_CANCELLED,
		restaurant_status: ORDER_CANCELLED,
		customer_status: ORDER_CANCELLED,
		admin_status: ORDER_CANCELLED,
		driver_status: ORDER_CANCELLED,
		delivery_status: ORDER_CANCELLED,
	},
	[ORDER_REJECTED] : {
		order_status: ORDER_REJECTED,
		restaurant_status: ORDER_REJECTED,
		admin_status: ORDER_REJECTED
	},
	[ORDER_REJECTED_BY_ADMIN] : {
		order_status: ORDER_REJECTED_BY_ADMIN,
		restaurant_status: ORDER_REJECTED,
		admin_status: ORDER_REJECTED_BY_ADMIN,
		customer_status: ORDER_REJECTED,
	},
	[ORDER_DRIVER_ACCEPTED] : {
		delivery_status: ORDER_DRIVER_ACCEPTED
	},
	[ORDER_DRIVER_ARRIVED_AT_RESTAURANT] : {
		delivery_status: ORDER_DRIVER_ARRIVED_AT_RESTAURANT
	},
	[ORDER_DRIVER_WAY_TO_CUSTOMER] : {
		order_status: ORDER_ON_THE_WAY,
		customer_status: ORDER_ON_THE_WAY,
		restaurant_status: ORDER_ON_THE_WAY,
		admin_status: ORDER_ON_THE_WAY,
		driver_status: ORDER_ON_THE_WAY,
		delivery_status: ORDER_DRIVER_WAY_TO_CUSTOMER
	},
	[ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION] : {
		delivery_status: ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION
	},
	[ORDER_DRIVER_ASSIGNED] : {
		delivery_status: ORDER_DRIVER_ASSIGNED
	},
	[ORDER_DRIVER_PASSED] : {
		delivery_status: "",
		assigned_captain: "",
		assigned_captain_status: ""
	},
	[ORDER_SUBMITTED] : {
		order_status: ORDER_SUBMITTED,
		restaurant_status: ORDER_PENDING,
		customer_status: ORDER_SUBMITTED,
		admin_status: ORDER_SUBMITTED
	}
};

/* to mark is_completed true*/
export const ORDER_FINISH_ACTIONS = [ORDER_REJECTED_BY_ADMIN, ORDER_CANCELLED, ORDER_DELIVERED];
/* status in which reason is required */
export const ORDER_REASON_STATUS = [ORDER_REJECTED, ORDER_CANCELLED, ORDER_REJECTED_BY_ADMIN];

export const ORDER_STATUS_TYPES = {
	[ORDER_PENDING] : { status_name: "Processing your info", label_class: "label-primary", restaurant_status_name: "Order Submitted" },
	[ORDER_SUBMITTED] : { status_name: "Order Submitted", label_class: "label-primary" },
	[ORDER_SCHEDULED] : { status_name: "Scheduled", label_class: "label-warning" },
	[ORDER_PREPARING] : { status_name: "Preparing", label_class: "label-success" },
	[ORDER_REJECTED] : { status_name: "Rejected", label_class: "label-danger" },
	[ORDER_REJECTED_BY_ADMIN] : { status_name: "Rejected", label_class: "label-danger" },
	[ORDER_READY_TO_PICK_UP] : { status_name: "Ready To Pick Up", label_class: "label-warning" },
	[ORDER_ON_THE_WAY] : { status_name: "Out for Delivery", label_class: "label-info" },
	[ORDER_ON_THE_WAY_TO_CUSTOMER] : { status_name: "Out for Delivery", label_class: "label-info" },
	[ORDER_DELIVERED] : { status_name: "Delivered", label_class: "label-success" },
	[ORDER_CANCELLED] : { status_name: "Cancelled", label_class: "label-danger" },
	[ORDER_CONFIRMED] : { status_name: "Confirmed", label_class: "label-success" },
	[ORDER_NOT_CONFIRMED] : { status_name: "Not Confirmed", label_class: "label-danger" },
	[ORDER_PROBLEMATIC] : { status_name: "Problematic", label_class: "label-danger" },
	/** Driver order status */
	[ORDER_DRIVER_ASSIGNED] : { status_name: "Assigned", label_class: "label-info" },
	[ORDER_DRIVER_ACCEPTED] : { status_name: "Way to restaurant", label_class: "label-success" },
	[ORDER_DRIVER_PASSED] : { status_name: "Passed", label_class: "label-warning" },
	[ORDER_DRIVER_UNDO_ASSIGNED] : { status_name: "Undo Assigned", label_class: "label-warning" },
	[ORDER_DRIVER_ARRIVED_AT_RESTAURANT] : { status_name: "Arrived At Restaurant", label_class: "label-success" },
	[ORDER_DRIVER_WAY_TO_CUSTOMER] : { status_name: "Out for Delivery", label_class: "label-info" },
	[ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION] : { status_name: "Arrived At Customer Location", label_class: "label-success" },
};

/* status to use in filtering of orders */
export const FILTER_ORDER_STATUS = {
	[ORDER_PENDING] : { status_name: "Processing your info", label_class: "label-primary" },
	[ORDER_SUBMITTED] : { status_name: "Order Submitted", label_class: "label-primary" },
	[ORDER_SCHEDULED] : { status_name: "Scheduled", label_class: "label-warning" },
	[ORDER_PREPARING] : { status_name: "Preparing", label_class: "label-success" },
	[ORDER_REJECTED] : { status_name: "Rejected", label_class: "label-danger" },
	[ORDER_READY_TO_PICK_UP] : { status_name: "Ready To Pick Up", label_class: "label-warning" },
	[ORDER_ON_THE_WAY] : { status_name: "Out for Delivery", label_class: "label-info" },
	[ORDER_DELIVERED] : { status_name: "Delivered", label_class: "label-success" },
	[ORDER_CANCELLED] : { status_name: "Cancelled", label_class: "label-danger" },
};

/* status to update in orders */
export const UPDATE_ORDER_STATUS = {
	[ORDER_SUBMITTED] : { status_name: "Order Submitted", label_class: "label-success", level: 1, reason: false },
	[ORDER_PREPARING] : { status_name: "Preparing", label_class: "label-success", level: 2, reason: false },
	[ORDER_READY_TO_PICK_UP] : { status_name: "Ready To Pick Up", label_class: "label-warning", level: 4, reason: false },
	[ORDER_ON_THE_WAY] : { status_name: "Out for Delivery", label_class: "label-info", level: 5, reason: false },
	[ORDER_DELIVERED] : { status_name: "Delivered", label_class: "label-success", level: 6, reason: false },
	[ORDER_REJECTED_BY_ADMIN] : { status_name: "Rejected", label_class: "label-danger", level: 7, reason: true },
	[ORDER_CANCELLED] : { status_name: "Cancelled", label_class: "label-danger", level: 8, reason: true },
};

export const ADMIN_ORDER_ACTIONS = {
	[ORDER_SUBMITTED] : { status_name: "Order Submitted", reason: false },
	[ORDER_PREPARING] : { status_name: "Preparing", reason: false },
	[ORDER_REJECTED_BY_ADMIN] : { status_name: "Rejected", label_class: "label-danger" },
	[ORDER_REJECTED] : { status_name: "Rejected", reason: true },
	[ORDER_READY_TO_PICK_UP] : { status_name: "Ready To Pick Up", reason: false },
	[ORDER_ON_THE_WAY] : { status_name: "Out for Delivery", reason: false },
	[ORDER_DELIVERED] : { status_name: "Delivered", reason: false },
	[ORDER_CANCELLED] : { status_name: "Cancelled", reason: true },
};

export const RESTAURANT_ORDER_STATUS_TYPES = {
	[ORDER_PENDING] : "Pending",
	[ORDER_PREPARING] : "Preparing",
	[ORDER_REJECTED] : "Rejected",
	[ORDER_READY_TO_PICK_UP] : "Ready To Pick Up",
	[ORDER_ON_THE_WAY] : "Out for Delivery",
	[ORDER_ON_THE_WAY_TO_CUSTOMER] : "Out for Delivery",
	[ORDER_DELIVERED] : "Delivered",
	[ORDER_CANCELLED] : "Cancelled",
};

/** Driver order status */
export const DRIVER_ORDER_STATUS = {
	[ORDER_DRIVER_FREE] : { title: "Free", label_class: "label-success", icon: WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/map_images/free_captain.png" },
	[ORDER_DRIVER_ASSIGNED] : { title: "Assigned", label_class: "label-primary", icon: WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/map_images/assigned_captain.png" },
	[ORDER_DRIVER_ACCEPTED] : { title: "Way to restaurant", label_class: "label-success", icon: WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/map_images/way-to-restaurant.png" },
	[ORDER_DRIVER_ARRIVED_AT_RESTAURANT] : { title: "Arrived at restaurant", label_class: "label-warning", icon: WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/map_images/arrived-at-restaurant.png" },
	[ORDER_DRIVER_WAY_TO_CUSTOMER] : { title: "Out for Delivery", label_class: "label-info", icon: WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/map_images/way-to-customer.png" },
	[ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION] : { title: "Arrived at customer location", label_class: "label-success", icon: WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/map_images/arrived_at_customer.png" },
};

/* status for driver pickup */
export const DRIVER_PICKUP_ORDER_STATUS = [ORDER_DRIVER_ACCEPTED, ORDER_DRIVER_ARRIVED_AT_RESTAURANT];

/** status for driver delivery */
export const DRIVER_DELIVERED_ORDER_STATUS = [ORDER_DRIVER_WAY_TO_CUSTOMER, ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION];

/* Driver update status array */
export const VALID_DRIVER_UPDATE_STATUS = [ORDER_DRIVER_ACCEPTED, ORDER_DRIVER_ARRIVED_AT_RESTAURANT, ORDER_DRIVER_WAY_TO_CUSTOMER, ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION, ORDER_DELIVERED];

/* Driver order status array */
export const DRIVER_ORDER_STATUS_ARRAY = [ORDER_DRIVER_WAY_TO_CUSTOMER, ORDER_DELIVERED, ORDER_CANCELLED, ORDER_DRIVER_ACCEPTED, ORDER_DRIVER_ARRIVED_AT_RESTAURANT, ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION, ORDER_DRIVER_ASSIGNED];

export const DRIVER_ORDER_VIEW_STATUS_ARRAY = [ORDER_DRIVER_WAY_TO_CUSTOMER, ORDER_DELIVERED, ORDER_CANCELLED, ORDER_DRIVER_ACCEPTED, ORDER_DRIVER_ARRIVED_AT_RESTAURANT, ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION, ORDER_DRIVER_ASSIGNED, ORDER_DRIVER_PASSED, ORDER_DRIVER_UNDO_ASSIGNED];

/** Map Icons */
export const DROPOFF_LOCATION_GOOGLE_MAP_ICON = WEBSITE_ADMIN_IMG_URL + 'dropoff32.png';
export const STORE_GOOGLE_MAP_ICON = WEBSITE_ADMIN_IMG_URL + 'store24.png';

/** Legends icon */
export const DROPOFF_LOCATION_GOOGLE_MAP_LEGEND_ICON = WEBSITE_ADMIN_IMG_URL + 'dropoff16.png';
export const STORE_GOOGLE_MAP_LEGEND_ICON = WEBSITE_ADMIN_IMG_URL + 'store16.png';

/** Order duplicate time */
export const DUPLICATE_ORDER_MINUTE = 15;

/** Big Order Amount  */
export const BIG_ORDER_AMOUNT = 20;

/** Menu end time and end date */
export const MERCHANT_UPLOADS_MENU_DATE_LIMIT = 31;
export const MERCHANT_UPLOADS_MENU_TIME_LIMIT = 23.59;

/** Captain tracking status */
export const CAPTAIN_ACTIVE = 1;
export const CAPTAIN_NOT_ACTIVE = 0;
export const CAPTAIN_TRACKING_STATUS = {
	[CAPTAIN_ACTIVE] : { status_name: "Active", label_class: "label-success" },
	[CAPTAIN_NOT_ACTIVE] : { status_name: "Not Active", label_class: "label-danger" },
};

export const CAPTAIN_ICON_IMAGE = WEBSITE_ADMIN_LOCAL_PUBLIC_PATH + "images/captain24.png";

/** Client status in add in wallet section */
export const CLIENT_ACTIVE = 1;
export const CLIENT_DEACTIVE = 0;
export const CLIENT_CRITERIA = {
	[CLIENT_ACTIVE] : { status_name: "Active", label_class: "label-success" },
	[CLIENT_DEACTIVE] : { status_name: "Deactive", label_class: "label-danger" },
};

/** Client Type */
export const CLIENT_TYPE_REGISTERED = "registered";
export const CLIENT_TYPE_GUEST = "guest";
export const CLIENT_TYPE = {
	[CLIENT_TYPE_REGISTERED] : "Registered",
	[CLIENT_TYPE_GUEST] : "Guest",
};

/** Account Criteria */
export const ACCOUNT_CRITERIA_AMOUNT_LESS_THAN = "amount_less_than";
export const ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN = "amount_greater_than";
export const ACCOUNT_CRITERIA_AMOUNT_LESS_THAN_EQUAL_TO = "amount_less_than_equal_to";
export const ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN_EQUAL_TO = "amount_greater_than_equal_to";
export const ACCOUNT_CRITERIA = {
	[ACCOUNT_CRITERIA_AMOUNT_LESS_THAN] : "Amount less than",
	[ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN] : "Amount greater than",
	[ACCOUNT_CRITERIA_AMOUNT_LESS_THAN_EQUAL_TO] : "Amount less than equal to",
	[ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN_EQUAL_TO] : "Amount greater than equal to",
};

/** User management Client Type */
export const USER_CLIENT_TYPE_NORMAL = "normal";
export const USER_CLIENT_TYPE_VIP = "vip";
export const USER_CLIENT_TYPE_PARTNER = "partner";
export const USER_CLIENT_TYPE = {
	[USER_CLIENT_TYPE_NORMAL] : "Normal",
	[USER_CLIENT_TYPE_VIP] : "VIP",
	[USER_CLIENT_TYPE_PARTNER] : "Partner",
};

/* New user days limit */
export const NEW_USER_DAYS = 7;

/** Offer status */
export const OFFER_PUBLISHED = 0;
export const OFFER_EXPIRED = 1;
export const OFFER_STATUS = {
	[OFFER_PUBLISHED] : { status_name: "Published", label_class: "label-success" },
	[OFFER_EXPIRED] : { status_name: "Expired", label_class: "label-danger" },
};

/** Vehicle Type */
export const VEHICLE_TYPE_BIKE = "bike";
export const VEHICLE_TYPE_CAR = "car";
export const VEHICLE_TYPE = {
	[VEHICLE_TYPE_BIKE] : "Bike",
	[VEHICLE_TYPE_CAR] : "Car",
};

/* Year limit */
export const YEAR_LIMIT = 4;

/** Used for wallet type  **/
export const REFUND_AMOUNT = "refund_amount";
export const CASHBACK_AMOUNT = "cashback_amount";
export const TOP_UP_AMOUNT = "top_up_amount";
export const POINTS_AMOUNT = "points_amount";
export const COMPENSATION_AMOUNT = "compensation_amount";
export const TRANSFERRED_BALANCE_AMOUNT = "transferred_balance_amount";

export const WALLET_TYPE = {
	[REFUND_AMOUNT] : "Refund Amount",
	[CASHBACK_AMOUNT] : "Cashback Amount",
	[COMPENSATION_AMOUNT] : "Compensation Amount",
	[TOP_UP_AMOUNT] : "Top Up Amount",
	[TRANSFERRED_BALANCE_AMOUNT] : "Transferred Balance Amount (Gift (kd))",
	[POINTS_AMOUNT] : "Rewards Points",
};

/** Default preparation or delivery time*/
export const DEFAULT_PREPARATION_TIME = 25;
export const DEFAULT_DELIVERY_TIME = 30;

/** VOC for status */
export const VOC_FOR_CAPTAIN = "captain";
export const VOC_FOR_CLIENT = "client";
export const VOC_FOR = {
	[VOC_FOR_CAPTAIN] : "Captain",
	[VOC_FOR_CLIENT] : "Client",
};

/** Question type for voc management **/
export const SINGLE_VOC_QUESTION_TYPE = "single";
export const INPUT_VOC_QUESTION_TYPE = "input";
export const VOC_QUESTION_TYPE = {
	[SINGLE_VOC_QUESTION_TYPE] : "Single",
	[INPUT_VOC_QUESTION_TYPE] : "Input",
};

/** VOC Type for client */
export const VOC_TYPE_FOR_CLIENT_ORDER_DELAY_BEFORE = "order_delay_before_delivery";
export const VOC_TYPE_FOR_CLIENT_ORDER_DELAY_AFTER = "order_delay_after_delivery";
export const VOC_TYPE_FOR_CLIENT_ORDER_CANCEL = "order_cancel";
export const VOC_TYPE_FOR_CLIENT_AFTER_FIRST_ORDER = "after_first_order";
export const VOC_TYPE_FOR_CLIENT_IF_NO_ORDER_PLACED = "if_no_order_placed";
export const VOC_TYPE_FOR_CLIENT_IF_NO_ORDER_PLACED_FOR_LONG_TIME = "if_no_order_placed_for_long_time";
export const VOC_TYPE_FOR_CLIENT = {
	[VOC_TYPE_FOR_CLIENT_ORDER_DELAY_BEFORE] : "Order delay before delivery",
	[VOC_TYPE_FOR_CLIENT_ORDER_DELAY_AFTER] : "Order delay after delivery",
	[VOC_TYPE_FOR_CLIENT_ORDER_CANCEL] : "Order cancel",
};

/** VOC Type for captain */
export const VOC_TYPE_FOR_CAPTAIN_DELAYED_ORDERS_TO_GET_IN_KITCHEN = "delayed_orders_to_get_in_kitchen";
export const VOC_TYPE_FOR_CAPTAIN_DELAYED_PICK_UP_TIME = "delayed_pick_up_time";
export const VOC_TYPE_FOR_CAPTAIN_DELAY_IN_ORDER_DELIVERY = "delay_in_order_delivery";
export const VOC_TYPE_FOR_CAPTAIN_ORDER_MARKED_PROBLEMATIC = "order_marked_problematic";
export const VOC_TYPE_FOR_CAPTAIN = {
	[VOC_TYPE_FOR_CAPTAIN_DELAYED_ORDERS_TO_GET_IN_KITCHEN] : "Delayed orders to get in kitchen",
	[VOC_TYPE_FOR_CAPTAIN_DELAYED_PICK_UP_TIME] : "Delayed pick up time",
	[VOC_TYPE_FOR_CAPTAIN_DELAY_IN_ORDER_DELIVERY] : "Delay in order delivery",
	[VOC_TYPE_FOR_CAPTAIN_ORDER_MARKED_PROBLEMATIC] : "Order marked as problematic",
};

/** Order delayed minute  */
export const DELAYED_PROCESS_MINUTE = 15;
export const DELAYED_ACCEPTANCE_MINUTE = 15;
export const DELAYED_PICKUP_BY_CAPTAIN_MINUTE = 15;
export const DELAYED_PICKEDUP_BY_CUSTOMER_MINUTE = 15;
export const DELAYED_PICKEDUP_BY_CRAVEZ_OR_RESTAURANT_MINUTE = 15;

/* Assignemnt types*/
export const AUTOMATIC_ASSIGNMENT = "automatic";
export const MANUAL_ASSIGNMENT = "manual";

export const ASSIGNMENT_TYPE = {
	[AUTOMATIC_ASSIGNMENT] : "Automatic",
	[MANUAL_ASSIGNMENT] : "Manual",
};

/* Reclaim logs action */
export const VERIFY_EXPIRE_DAY = 3;
export const RECLAIM_LOGS_ACTIVE_ACTION = "active";
export const RECLAIM_LOGS_DEACTIVE_ACTION = "deactive";
export const RECLAIM_LOGS_RECLAIM_ACTION = "reclaim";
export const RECLAIM_LOGS_VERIFY_MOBILE_ACTION = "verify_mobile";
export const RECLAIM_LOGS_VERIFY_EMAIL_ACTION = "verify_email";
export const RECLAIM_LOGS_REGISTRATION = "registration";

export const RECLAIM_LOGS_ACTION_TYPE = {
	[RECLAIM_LOGS_ACTIVE_ACTION] : "Active",
	[RECLAIM_LOGS_DEACTIVE_ACTION] : "Deactive",
	[RECLAIM_LOGS_RECLAIM_ACTION] : "Reclaim",
	[RECLAIM_LOGS_VERIFY_MOBILE_ACTION] : "Verify mobile",
	[RECLAIM_LOGS_VERIFY_EMAIL_ACTION] : "Verify email",
	[RECLAIM_LOGS_REGISTRATION] : "Registration",
};

/* Discount inputs in corporate tie ups */
export const CORPORATE_DISCOUNT_LENGTH = 5;

/* Corporate heading column */
export const CORPORATE_HEADING_COLUMN = 6;

/* transaction type */
export const WALLET_TRANSACTION_TYPE = {
	[DEBIT] : "Debit",
	[CREDIT] : "Credit",
};

/* delivery status types */
export const ORDER_STATUS_DELIVERY_TYPES = {
	[ORDER_PREPARING] : { status_name: "Preparing", label_class: "label-success" },
	[ORDER_ON_THE_WAY] : { status_name: "Out for Delivery", label_class: "label-info" },
	[ORDER_DELIVERED] : { status_name: "Delivered", label_class: "label-success" },
};

/** TO show delivery status in order tracking section */
export const DELIVERY_ORDER_STATUS = {
	[ORDER_DRIVER_ACCEPTED] : { status_name: "Way to restaurant", label_class: "label-primary" },
	[ORDER_DRIVER_ARRIVED_AT_RESTAURANT] : { status_name: "Arrived at restaurant", label_class: "label-warning" },
	[ORDER_DRIVER_WAY_TO_CUSTOMER] : { status_name: "Out for Delivery", label_class: "label-info" },
	[ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION] : { status_name: "Arrived at customer location", label_class: "label-success" },
	[ORDER_CANCELLED] : { status_name: "Cancelled", label_class: "label-danger" },
	[ORDER_DELIVERED] : { status_name: "Delivered", label_class: "label-success" },
};

/** VOC Type for captain */
export const ORDER_CRITERIA_TYPE_ORDER_AMOUNT = "order_amount";
export const ORDER_CRITERIA_TYPE_NO_OF_ORDERS = "no_of_orders";
export const ORDER_CRITERIA_TYPE = {
	[ORDER_CRITERIA_TYPE_ORDER_AMOUNT] : "Order amount",
	[ORDER_CRITERIA_TYPE_NO_OF_ORDERS] : "No. of orders",
};

/** Payment status */
export const PAYMENT_PENDING = "pending"
export const PAYMENT_SUCCESS = "success";
export const PAYMENT_FAILED = "failed";
export const PAYMENT_CANCELED = "canceled";

/** Payment status object */
export const PAYMENT_STATUS = {
	[PAYMENT_PENDING] : { status_name: "Pending", label_class: "label-info" },
	[PAYMENT_SUCCESS] : { status_name: "Success", label_class: "label-success" },
	[PAYMENT_FAILED] : { status_name: "Failed", label_class: "label-warning" },
	[PAYMENT_CANCELED] : { status_name: "Canceled", label_class: "label-danger" },
};

/** Payment type */
export const ORDER_PAYMENT = "order";

/** Branch offer link */
export const BRANCH_OFFER_LINK = WEBSITE_URL + 'app_link?type=branch_link';

/** Automated ticket category */
export const TICKET_CATEGORY_ASSIGNMENT = "5ea67d961ca527390e13d35b";
export const TICKET_CATEGORY_FOLLOW_UP = "5e9d6017417b8a0d83efd2a6";
export const TICKET_CATEGORY_COMPLAINT = "5e9d5ffa417b8a0d83efd2a0";

/** Automated ticket sub category */
export const TICKET_SUB_CATEGORY_REFUND_FOLLOW_UP = "60db108f8fea0c72d7b93b79";
export const TICKET_SUB_CATEGORY_DRIVER_ASSIGNMENT = "5ea67dad1ca527390e13d35d";
export const TICKET_SUB_CATEGORY_RESTAURANT_DELAY_PREPARING = "5eafb3b88c4aa76d4015354e";
export const TICKET_SUB_CATEGORY_DELAY_PICKUP = "5eafbe8895d00f2a757086b7";
export const TICKET_SUB_CATEGORY_DELAY_DELIVERY = "5eafc55295d00f2a757086bf";
export const TICKET_SUB_CATEGORY_KFG_ORDER_PLACE = "5ef0bd7ea181ab0a4226418d";
export const TICKET_SUB_CATEGORY_ORDER_STATUS_UPDATED = "601a90106788b4210020f854";
export const TICKET_TITLE_ORDER_MARKED_CANCELLED_TO_DELIVERED = "601a906e6788b4210020f856";
export const TICKET_TITLE_ORDER_MARKED_DELIVERED_TO_CANCELLED = "601a90776788b4210020f858";

/** Automated ticket title */
export const TICKET_TITLE_ORDER_REFUND = "60db109a8fea0c72d7b93b7b";
export const TICKET_TITLE_DRIVER_NOT_AVAILABLE = "5ea67e7d1ca527390e13d35f";
export const TICKET_TITLE_RESTAURANT_DELAY_PREPARING = "5eafb4538c4aa76d40153550";
export const TICKET_TITLE_FLEET_DELAYED_PICKUP = "5eafbf3b95d00f2a757086b9";
export const TICKET_TITLE_RESTAURANT_DELAYED_PICKUP = "5eafc0fb95d00f2a757086bb";
export const TICKET_TITLE_FLEET_DELAYED_DELIVERY = "5eafc5ad95d00f2a757086c1";
export const TICKET_TITLE_RESTAURANT_DELAYED_DELIVERY = "5eafd1908df888510b3d7703";
export const TICKET_TITLE_KFG_ORDER_NOT_PLACE = "5ef0be5ba181ab0a4226418f";

/** Ticket automated type */
export const AUTOMATED_TICKET_FOR_DRIVER_NOT_AVAILABLE = "driver_not_available";
export const AUTOMATED_TICKET_FOR_DELAYED_PREPRATION = "exceeding_order_prepration_time";
export const AUTOMATED_TICKET_FOR_DELAYED_PICKUP_ORDER = "delayed_captain_pickup_order";
export const AUTOMATED_TICKET_FOR_FOLLOW_UP_RESTAURANT = "follow_up_restaurant";
export const AUTOMATED_TICKET_FOR_DELAYED_DELIVER_ORDER = "delayed_order_deliver_captain";
export const AUTOMATED_TICKET_FOR_FOLLOW_UP_WITH_RESTAURANT_AND_CUSTOMER = "follow_up_with_restaurant_and_customer";
export const AUTOMATED_TICKET_FOR_NOT_PLACE_KFG_ORDER = "not_place_kfg_order";
export const AUTOMATED_TICKET_FOR_KFG_ORDER_FOR_NOT_UPDATED = "not_updatef_aghzeya_order";
export const AUTOMATED_TICKET_FOR_ORDER_MARKED_TO_DELIVERED = "order_marked_to_delivered";
export const AUTOMATED_TICKET_FOR_ORDER_MARKED_TO_CANCELLED = "order_marked_to_cancelled";
export const AUTOMATED_TICKET_FOR_ORDER_REFUND = "order_refund_follow_up";

export const AUTOMATED_TICKET_INPUT = {
	[AUTOMATED_TICKET_FOR_ORDER_REFUND] : {
		category: TICKET_CATEGORY_FOLLOW_UP,
		sub_category: TICKET_SUB_CATEGORY_REFUND_FOLLOW_UP,
		title: TICKET_TITLE_ORDER_REFUND,
		department: FINANCE_TEAM,
		description: "Order({ORDER_ID}) give a refund. Please check carefully ",
		constants: ['{ORDER_ID}'],
	},
	[AUTOMATED_TICKET_FOR_DRIVER_NOT_AVAILABLE] : {
		category: TICKET_CATEGORY_ASSIGNMENT,
		sub_category: TICKET_SUB_CATEGORY_DRIVER_ASSIGNMENT,
		title: TICKET_TITLE_DRIVER_NOT_AVAILABLE,
		department: FLEET,
		description: "Driver Not Available",
	},
	[AUTOMATED_TICKET_FOR_DELAYED_PREPRATION] : {
		category: TICKET_CATEGORY_FOLLOW_UP,
		sub_category: TICKET_SUB_CATEGORY_RESTAURANT_DELAY_PREPARING,
		title: TICKET_TITLE_RESTAURANT_DELAY_PREPARING,
		department: BACK_OFFICE_TEAM,
		description: "Exceeding Order Prepration Time",
	},
	[AUTOMATED_TICKET_FOR_DELAYED_PICKUP_ORDER] : {
		category: TICKET_CATEGORY_COMPLAINT,
		sub_category: TICKET_SUB_CATEGORY_DELAY_PICKUP,
		title: TICKET_TITLE_FLEET_DELAYED_PICKUP,
		department: FLEET,
		description: "Within how many minutes captain would pick order up",
	},
	[AUTOMATED_TICKET_FOR_FOLLOW_UP_RESTAURANT] : {
		category: TICKET_CATEGORY_COMPLAINT,
		sub_category: TICKET_SUB_CATEGORY_DELAY_PICKUP,
		title: TICKET_TITLE_RESTAURANT_DELAYED_PICKUP,
		department: BACK_OFFICE_TEAM,
		description: "The order might delayed, follow up with the restaurant",
	},
	[AUTOMATED_TICKET_FOR_DELAYED_DELIVER_ORDER] : {
		category: TICKET_CATEGORY_COMPLAINT,
		sub_category: TICKET_SUB_CATEGORY_DELAY_DELIVERY,
		title: TICKET_TITLE_FLEET_DELAYED_DELIVERY,
		department: FLEET,
		description: "Within how many minutes captain would deliver the order",
	},
	[AUTOMATED_TICKET_FOR_FOLLOW_UP_WITH_RESTAURANT_AND_CUSTOMER] : {
		category: TICKET_CATEGORY_COMPLAINT,
		sub_category: TICKET_SUB_CATEGORY_DELAY_DELIVERY,
		title: TICKET_TITLE_RESTAURANT_DELAYED_DELIVERY,
		department: BACK_OFFICE_TEAM,
		description: "The order might delayed, follow up with both the restaurant and the customer",
	},
	[AUTOMATED_TICKET_FOR_NOT_PLACE_KFG_ORDER] : {
		category: TICKET_CATEGORY_FOLLOW_UP,
		sub_category: TICKET_SUB_CATEGORY_KFG_ORDER_PLACE,
		title: TICKET_TITLE_KFG_ORDER_NOT_PLACE,
		department: SUPERVISOR,
		description: "Order({ORDER_ID}) not place on api server due to- {REASON}.",
		constants: ['{ORDER_ID}', "{REASON}"],
	},
	[AUTOMATED_TICKET_FOR_KFG_ORDER_FOR_NOT_UPDATED] : {
		category: TICKET_CATEGORY_FOLLOW_UP,
		sub_category: TICKET_SUB_CATEGORY_KFG_ORDER_PLACE,
		title: TICKET_TITLE_KFG_ORDER_NOT_PLACE,
		department: SUPERVISOR,
		description: "Order({ORDER_ID}) not update on api server due to- {REASON}.",
		constants: ['{ORDER_ID}', "{REASON}"],
	},
	[AUTOMATED_TICKET_FOR_ORDER_MARKED_TO_DELIVERED] : {
		category: TICKET_CATEGORY_FOLLOW_UP,
		sub_category: TICKET_SUB_CATEGORY_ORDER_STATUS_UPDATED,
		title: TICKET_TITLE_ORDER_MARKED_CANCELLED_TO_DELIVERED,
		department: FINANCE_TEAM,
		description: "Cancelled order({ORDER_ID}) is marked as delivered. Please check carefully",
		constants: ['{ORDER_ID}'],
	},
	[AUTOMATED_TICKET_FOR_ORDER_MARKED_TO_CANCELLED] : {
		category: TICKET_CATEGORY_FOLLOW_UP,
		sub_category: TICKET_SUB_CATEGORY_ORDER_STATUS_UPDATED,
		title: TICKET_TITLE_ORDER_MARKED_DELIVERED_TO_CANCELLED,
		department: FINANCE_TEAM,
		description: "Delivered order({ORDER_ID}) is marked as cancelled. Please check carefully",
		constants: ['{ORDER_ID}'],
	}
};

/* Screen visits list */
export const SCREEN_VISITS = {
	["order"] : {
		"orderListing": "Order Listing",
		"getOrderDetails": "Get Order Details",
		"getAcceptedOrderList": "Get Accepted Order List",
		"placeOrder": "Place Order"
	},
	["restaurant"] : {
		"getItemList": "Get Item List",
		"getRestaurantList": "Get Restaurant List",
		"getItemDetails": "Get Item Details",
		"getCategoryListWithItem": "Get Category List With Item"
	}
};

/** Branch discount type */
export const BRANCH_EXTRA_CHARGE = "extra_change";
export const BRANCH_EXTRA_CHARGE_PERCENTAGE = "extra_change_percentage";
export const BRANCH_DISCOUNT_BY_VALUE = "discount_by_value";
export const BRANCH_DISCOUNT_BY_PERCENTAGE = "discount_by_percentage";
export const BRANCH_DISCOUNT_TYPE = {
	[BRANCH_EXTRA_CHARGE] : "Extra charge by value",
	[BRANCH_EXTRA_CHARGE_PERCENTAGE] : "Extra charge percentage",
	[BRANCH_DISCOUNT_BY_VALUE] : "Discount by value",
	[BRANCH_DISCOUNT_BY_PERCENTAGE] : "Discount by percentage",
};

/** Payment Status*/
export const PAID = "paid";
export const UNPAID = "not_paid";

/** Payment Type*/
export const ORDER_REFUND_PAYMENT = "refund_order_payment";
export const PACKAGE_REFUND_PAYMENT = "refund_package_payment";
export const OUTSTANDING_PAYMENT = "outstanding_payment";

export const REFUND_INITIALIZE = "refund_initialize";
export const REFUND_COMPLETED = "refund_completed";
export const PAYMENT_REFUND_STATUS = {
	[REFUND_INITIALIZE] : { status_name: "Initialized", label_class: "label-primary" },
	[REFUND_COMPLETED] : { status_name: "Paid", label_class: "label-success" },
};

export const REFUND_MODIFY_ORDER = "refund_modify_order";
export const DIRECT_REFUND = "direct_refund";
export const REFUND_CANCEL_ORDER = "refund_cancel_order";
export const REFUND_REJECT_ORDER = "refund_reject_order";
export const REFUND_PACKAGE_REJECT = "refund_package_reject";

/** Constant for driver delivery graph*/
export const GRAPH_DATE_FORMAT = "%Y-%m-%d";

/** Constant for add money payment response event type */
export const ADD_MONEY_IN_WALLET = "add_in_wallet";

/** Constant for package purchase payment event type */
export const PACKAGE_PURCHASE_PAYMENT_EVENT = "package_purchase";

/** Constant for package request status */
export const PACKAGE_REQUEST_PENDING = 'pending';
export const PACKAGE_REQUEST_ACCEPTED = 'accepted';
export const PACKAGE_REQUEST_REJECTED = 'rejected';
export const PACKAGE_REQUEST_STATUS_OBJECT = {
	[PACKAGE_REQUEST_PENDING] : "Pending",
	[PACKAGE_REQUEST_ACCEPTED] : "Accepted",
	[PACKAGE_REQUEST_REJECTED] : "Rejected",
};

/** Order canceled reason*/
export const PACKAGE_GETS_DAMAGED = "Package gets damaged";
export const ACCIDENT = "accident";
export const TRAFFIC_JAM = "traffic_jam";
export const CAR_BREAKDOWN = "car_breakdown";
export const ORDER_NOT_READY = "order_not_ready";
export const CUSTOMER_REQUESTS_LINK = "customer_requests_link";
export const OTHERS = "others";

export const ORDER_CANCELED_REASON_TYPE = {
	[ACCIDENT] : { title: "Accident", title_ar: "حادث" },
	[TRAFFIC_JAM] : { title: "Traffic Jam", title_ar: "الازدحام المروري" },
	[CAR_BREAKDOWN] : { title: "Car Breakdown", title_ar: "انهيار السيارة" },
	[ORDER_NOT_READY] : { title: "Order Not Ready", title_ar: "الطلب غير جاهز" },
	[CUSTOMER_REQUESTS_LINK] : { title: "Customer Requests a Link", title_ar: "يطلب العميل الارتباط" },
	[OTHERS] : { title: "Others", title_ar: "الآخرين" },
};

/** Max last days for save customer order report  */
export const CUSTOMER_ORDER_REPORT_DAYS = 2;

/** To import excel files*/
export const EXCEL_FILE_EXTENSION = "xlsx";
export const IMPORT_SECTION_FILE_PATH = WEBSITE_UPLOADS_ROOT_PATH + "import_section/";
export const NO_OF_DAYS_FOR_IMPORTED_PACKAGES = 30;
export const IMPORT_USER_PASSWORD = "cravez";

/* Package status  */
export const PACKAGE_RUNNING = "running";
export const PACKAGE_EXPIRE = "expire";
export const PACKAGE_NOT_PURCHASED = "not_purchased";
export const MAX_ORDER_MODIFY_DIVIDED = 2;

/* Package unlimited constant  */
export const PACKAGE_UMLIMITED = "Unlimited";

/* Ratings Type*/
export const RATING_TO_RESTAURANT = "rating_to_restaurant_from_customer";

/*Max Ratting*/
export const MAX_RATTING = 5;

/** Order institution number */
export const ORDER_INSTITUTION_NUMBER = "02";
export const GUEST_MOBILE_NUMBER = "00000000";
export const ANDROID_DEVICE = "android";
export const IOS_DEVICE = "ios";
export const ANDROID_PLATFORM = "01";
export const IOS_PLATFORM = "02";
export const MAX_CLIENT_NUMBER_DIGIT = 8;
export const MAX_ORDER_COUNT_DIGIT_FOR_UNIQUE_ID = 7;

/* shift setup */
export const SHIFT_TIME = "00.01";

/** Assignment cron max process minute */
export const ASSIGNMENT_CRON_PROCESS_MINUTE = 5;

/** Sales report dropdown **/
export const TOTAL_ORDER_PER_RESTAURANT = "total_order_per_restaurant";
export const REDEEM_EVERY_OFFER_REPORT = "redeem_every_offer_report";
export const TOTAL_ORDERS_PER_REST_WITHOUT_OFFERS = "total_order_per_rest_without_offers";
export const TOTAL_ORDERS_PER_REST_WITH_OFFERS = "total_order_per_rest_with_offers";
export const CANCELLATION_REPORT = "cancellation_report";
export const REJECTED_REPORT = "rejected_report";
export const TOTAL_ORDERS_PER_REST_WITH_PAYMENT_METHOD = "total_order_per_rest_with_payment_method";

export const SALES_REPORT_DROPDOWN = {
	[TOTAL_ORDER_PER_RESTAURANT] : { status_name: "Total order per restaurant" },
	[REDEEM_EVERY_OFFER_REPORT] : { status_name: "Redeem every offer report" },
	[TOTAL_ORDERS_PER_REST_WITHOUT_OFFERS] : { status_name: "Total orders per restaurant without offers" },
	[TOTAL_ORDERS_PER_REST_WITH_OFFERS] : { status_name: "Total orders per restaurant with offers" },
	[CANCELLATION_REPORT] : { status_name: "Cancellation report" },
	[REJECTED_REPORT] : { status_name: "Rejected report" },
	[TOTAL_ORDERS_PER_REST_WITH_PAYMENT_METHOD] : { status_name: "Total orders per restaurant with selected the payment method" },
};

/** Sales report excel & chart */
export const SALES_REPORT_EXCEL = "excel";
export const SALES_REPORT_CHART = "chart";

/** Settlement methods*/
export const CASH_SETTLEMENT_METHOD = "cash";
export const CHEQUE_SETTLEMENT_METHOD = "cheque";
export const TRANSFER_SETTLEMENT_METHOD = "transfer";

/** Conformance hours */
export const CONFORMANCE_HOURS = 8;
export const CONFORMANCE_WORKING_SECONDS = 16200;

/** Quality Categories*/
export const END_USER_CRITICAL = 'end-user-critical';
export const BUSINESS_CRITICAL = 'business-critical';
export const NON_CRITICAL = 'non-critical';

/** AHT calculation */
export const AHT_CALCULATION = [
	{ min: 0, max: 180, percentage: 10 },
	{ min: 181, max: 210, percentage: 6 },
	{ min: 211, max: 240, percentage: 3 },
	{ min: 240, max: 1000, percentage: 0 },
];

/** Conformance calculation */
export const CONFORMANCE_CALCULATION = [
	{ min: 0, max: 99.99, percentage: 0 },
	{ min: 100, max: 500, percentage: 10 },
];

/** NR calculation */
export const NR_CALCULATION = [
	{ min: 0, max: 30, percentage: 5 },
	{ min: 31, max: 35, percentage: 3 },
	{ min: 35, max: 40, percentage: 1 },
	{ min: 41, max: 1000, percentage: 0 },
];

/** Tardiness calculation */
export const TARDINESS_CALCULATION = [
	{ min: 0, max: 5, percentage: 10 },
	{ min: 6, max: 10, percentage: 7 },
	{ min: 11, max: 20, percentage: 5 },
	{ min: 21, max: 100, percentage: 0 },
];

/** Quality calculation */
export const QUALITY_CALCULATION = {
	END_USER_CRITICAL: [
		{ value: 0, percentage: 20 },
		{ value: 1, percentage: 10 },
		{ value: 2, percentage: 5 },
		{ value: 3, percentage: 0 },
	],
	BUSINESS_CRITICAL: [
		{ value: 0, percentage: 10 },
		{ value: 1, percentage: 5 },
		{ value: 2, percentage: 3 },
		{ value: 3, percentage: 0 },
	],
	NON_CRITICAL: [
		{ min: 0, max: 5, percentage: 5 },
		{ min: 6, max: 10, percentage: 3 },
		{ min: 11, max: 100, percentage: 0 },
	],
};

/** Abandoned calculation */
export const ABANDONED_CALCULATION = [
	{ value: 0, percentage: 5 },
	{ value: 1, percentage: 3 },
	{ value: 2, percentage: 0 },
];

/** Absent calculation settings */
export const ABSENT_TOTAL_PERCENTAGE = 20;

export const CASUAL_ONE = 1;
export const CASUAL_TWO = 2;
export const CASUAL_THREE = 3;
export const SICK_FOUR = 4;
export const SICK_FIVE = 5;
export const CASUAL_OTHER = "2+";

export const ABSENT_CALCULATION = {
	CASUAL_LEAVE: [
		{ CASUAL_ONE: { 'Weekend': 20, 'Working': 20 } },
		{ CASUAL_TWO: { 'Weekend': 10, 'Working': 15 } },
		{ CASUAL_THREE: { 'Weekend': 0, 'Working': 0 } },
	],
	SICK_LEAVE: [
		{ CASUAL_ONE: { 'Weekend': 20, 'Working': 20 } },
		{ CASUAL_TWO: { 'Weekend': 20, 'Working': 20 } },
		{ CASUAL_THREE: { 'Weekend': 10, 'Working': 15 } },
		{ SICK_FOUR: { 'Weekend': 0, 'Working': 10 } },
		{ SICK_FIVE: { 'Weekend': 0, 'Working': 0 } },
	],
	WEEKLY_OFF: {
		value: 1, percentage: 0
	}
};

export const CASUAL_LEAVE_TYPE = {
	[CASUAL_ONE] : { 'Weekend': 0, 'Working': 0 },
	[CASUAL_TWO] : { 'Weekend': 10, 'Working': 5 },
	[CASUAL_OTHER] : { 'Weekend': 20, 'Working': 20 },
};

export const SICK_LEAVE_TYPE = {
	[CASUAL_TWO] : { 'Weekend': 0, 'Working': 0 },
	[CASUAL_THREE] : { 'Weekend': 10, 'Working': 5 },
	[SICK_FIVE] : { 'Working': 10 },
	[CASUAL_OTHER] : { 'Weekend': 20, 'Working': 20 },
};

/** Conformance weekend days */
export const WEEKEND_DAYS = [THURSDAY, FRIDAY, SATURDAY];

/** Constant for offer sub type */
export const FREE_OFFER = 'free_offer';
export const PAID_OFFER = 'paid_offer';
export const OFFER_SUB_TYPES = {
	[FREE_OFFER] : "Free Offer",
	[PAID_OFFER] : "Paid Offer",
};

/** Constant for refund type in orders */
export const REFUND = 'refund';
export const COMPENSATION = 'compensation';
export const REFUND_TYPE = {
	[REFUND] : "Refund",
	[COMPENSATION] : "Compensation",
};

/** Constant for amount range filter */
export const ZERO_TO_SIX = 'zero_to_six_kd';
export const SIX_TO_EIGHT = 'six_to_eight_kd';
export const EIGHT_TO_ELEVEN = 'eight_to_eleven_kd';
export const ELEVEN_TO_FIFTEEN = 'eleven_to_fifteen_kd';
export const GREATER_THAN_FIFTEEN = 'greater_than_fifteen_kd';
export const AMOUNT_RANGE = {
	[ZERO_TO_SIX] : "0-6 KD",
	[SIX_TO_EIGHT] : "6-8 KD",
	[EIGHT_TO_ELEVEN] : "8-11 KD",
	[ELEVEN_TO_FIFTEEN] : "11-15 KD",
	[GREATER_THAN_FIFTEEN] : "> 15 KD",
};

/** Constant for order amount conditions */
export const ZERO_AMOUNT = 0;
export const SIX_AMOUNT = 6;
export const EIGHT_AMOUNT = 8;
export const ELEVEN_AMOUNT = 11;
export const FIFTEEN_AMOUNT = 15;

/* attribute type used in attributes */
export const BRANCH_AREA_ATTRIBUTE_TYPE = "branch_area";
export const BRANCH_ATTRIBUTES_ATTRIBUTE_TYPE = "branch_attributes";

/* validation type used in attributes */
export const TEXT_ATTRIBUTE_VALIDATION = "text";
export const PERCENTAGE_ATTRIBUTE_VALIDATION = "percentage";
export const NUMERIC_ATTRIBUTE_VALIDATION = "numeric";
export const FLOAT_ATTRIBUTE_VALIDATION = "float";

/** Constant for partners in orders */
export const KFG_PARTNER = 'kfg';
export const PARTNERS = {
	[KFG_PARTNER] : "KFG"
};

export const ORDER_CANCEL_ROLE = {
	[FLEET] : "Fleet",
	[CRAVEZ] : "Cravez",
	[CUSTOMER] : "Customer",
	[RESTAURANT] : "Restaurant",
};

export const MORNING_PROFILE_MAX_TIME = 11.59;

/** Constant for vehicle status */
export const READY_VEHICLE = 'ready';
export const ACCIDENT_VEHICLE = 'accident';
export const RESERVED_BY_POLICE_VEHICLE = 'reserved_by_police';
export const NEED_MAINTAINANCE_VEHICLE = 'need_maintainance';
export const VEHICLE_STATUS = {
	[READY_VEHICLE] : "Ready",
	[ACCIDENT_VEHICLE] : "Accident",
	[RESERVED_BY_POLICE_VEHICLE] : "Reserved By Police",
	[NEED_MAINTAINANCE_VEHICLE] : "Need Maintainance",
};

/** Constant for generate captain id perfix */
export const CAPTAIN_ID_PREFIX = "CD";

/** Constant for restaurant type */
export const REDEEMED_FOR_ALL_RESTAURANTS = 'all_restaurants';
export const REDEEMED_FOR_ALL_RESTAURANTS_DELIVERED_BY_CRAVEZ = 'delivered_by_cravez';
export const REDEEMED_FOR_ALL_RESTAURANTS_DELIVERED_BY_RESTAURANT = 'delivered_by_restaurant';
export const RESTAURANT_TYPES = {
	[REDEEMED_FOR_ALL_RESTAURANTS] : "All Restaurants",
	[REDEEMED_FOR_ALL_RESTAURANTS_DELIVERED_BY_CRAVEZ] : "Delivered By Cravez",
	[REDEEMED_FOR_ALL_RESTAURANTS_DELIVERED_BY_RESTAURANT] : "Delivered By Restaurant",
};

/** Random offer code string  */
export const RANDOM_OFFER_CODE_MAX_CHARACTER = 3;

/** TO show delivery status in order section */
export const DELIVERY_STATUS = {
	[ORDER_DRIVER_ACCEPTED] : { status_name: "Way to restaurant", label_class: "label-primary" },
	[ORDER_DRIVER_ARRIVED_AT_RESTAURANT] : { status_name: "Arrived at restaurant", label_class: "label-warning" },
	[ORDER_DRIVER_WAY_TO_CUSTOMER] : { status_name: "Way to customer", label_class: "label-info" },
	[ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION] : { status_name: "Arrived at customer location", label_class: "label-success" },
};

/** Order assigned filter options */
export const ORDER_ASSIGNED = "assigned";
export const ORDER_NOT_ASSIGNED = "not_assigned";

export const ORDER_ASSIGNED_FILTER = {
	[ORDER_ASSIGNED] : "Assigned",
	[ORDER_NOT_ASSIGNED] : "Not Assigned",
};

/** Driver status for perform multiple action **/
export const DRIVER_ACTIVE = 1;
export const DRIVER_DEACTIVE = 2;
export const DRIVER_DELETE = 3;

/** Menu Types */
export const STANDALONE_MENU = "standalone";
export const GLOBAL_MENU = "global";

export const MENU_TYPE = {
	[GLOBAL_MENU] : "Global",
	[STANDALONE_MENU] : "Standalone",
};

/** Address Types */
export const ADDRESS_TYPE_HOME = 'House';
export const ADDRESS_TYPE_APARTMENT = 'Apartment';
export const ADDRESS_TYPE_BUILDING = 'Building';

export const ADDRESS_TYPE = {
	[ADDRESS_TYPE_HOME] : "House",
	[ADDRESS_TYPE_APARTMENT] : "Apartment",
	[ADDRESS_TYPE_BUILDING] : "Building",
};

/*** Schedule pn type*/
export const INSTANT_PN = "instant";
export const FUTURE_PN = "future";
export const SCHEDULE_PN_TYPE = {
	[INSTANT_PN] : "Instant",
	[FUTURE_PN] : "Future",
};

/** Push Notificaiton wallet search rules */
export const AMOUNT_EQUALS_TO = "=";
export const AMOUNT_LESS_THAN = "<";
export const AMOUNT_GREATER_THAN = ">";
export const AMOUNT_LESS_THAN_EQUALS_TO = "<=";
export const AMOUNT_GREATER_THAN_EQUALS_TO = ">=";
export const AMOUNT_IS_NULL = "null";
export const AMOUNT_IS_NOT_NULL = "not_null";

export const AMOUNT_SEARCH_RULES = {
	[AMOUNT_EQUALS_TO] : "Equals to",
	[AMOUNT_LESS_THAN] : "<",
	[AMOUNT_GREATER_THAN] : ">",
	[AMOUNT_LESS_THAN_EQUALS_TO] : "<=",
	[AMOUNT_GREATER_THAN_EQUALS_TO] : ">=",
	[AMOUNT_IS_NULL] : "IS NULL",
	[AMOUNT_IS_NOT_NULL] : "IS NOT NULL",
};

/** PN Status */
export const PN_SCHEDULED = "scheduled";
export const PN_SENT = "sent";
export const PN_STATUSES = {
	[PN_SCHEDULED] : "Scheduled",
	[PN_SENT] : "Sent",
};

/** PN Payloads */
export const PAYLOAD_NEWSFEED = "newsfeed";
export const PAYLOAD_OFFERS = "offers_screen";
export const PAYLOAD_BRANCH_MENU = "open_branch";
export const PAYLOAD_EDIT_PROFILE = "edit_profile";
export const PAYLOAD_SEARCH_BY_DISH = "search_by_dish";
export const PAYLOAD_BRANCH_MENU_WITH_CATEGORY = "branch_menu_with_category";

export const PN_PAYLOAD_TYPES = {
	[PAYLOAD_NEWSFEED] : "Open Newsfeed screen on App",
	[PAYLOAD_OFFERS] : "Open Offers screen on App",
	[PAYLOAD_BRANCH_MENU] : "Open Branch on App",
	[PAYLOAD_EDIT_PROFILE] : "Open Edit Profile on App",
	[PAYLOAD_SEARCH_BY_DISH] : "Open Search by dish Screen on App",
	[PAYLOAD_BRANCH_MENU_WITH_CATEGORY] : "Open Branch Menu with a Category Opened on App",
};

/** Time passed minute limit */
export const TIME_PASSED_MINUTE_LIMIT = 240;

/** Type of call for quality monitor form */
export const INBOUND_CALL = "inbound_call";
export const OUTBOUND_CALL = "outbound_call";
export const ESCALATION_FOLLOW_UP = "escalation_follow_up";
export const TYPE_OF_CALL = {
	[INBOUND_CALL] : "Inbound Call",
	[OUTBOUND_CALL] : "Outbound Call",
	[ESCALATION_FOLLOW_UP] : "Escalation/Follow Up",
};

/** Type of call enquiry list for quality monitor form */
export const ENQUIRY = "enquiry";
export const COMPLAINT = "complaint";
export const REQUEST = "request";
export const TRANSACTION = "transaction";
export const TYPE_OF_CALL_ENQUIRY_LIST = {
	[ENQUIRY] : "Enquiry",
	[COMPLAINT] : "Complaint",
	[REQUEST] : "Request",
	[TRANSACTION] : "Transaction",
};

/** Team list for quality monitor form */
export const CRAVEZ_TEAM = "cravez";
export const MK_TEAM = "mk";
export const ETC_TEAM = "etc";
export const TEAM_QUALITY_MONITOR_LIST = {
	[CRAVEZ_TEAM] : "Cravez",
	[MK_TEAM] : "MK",
	[ETC_TEAM] : "Etc",
};

/** Country name constant */
export const COUNTRY_NAME = {
	"en": "Kuwait",
	"ar": "الكويت"
};

/** URL of crons server where setting file to be write*/
export const SETTINGS_FILE_WRITE_URL = process.env.CRON_SERVER_URL + "/crons/write_settings_file";

/*** Customer verification types*/
export const CUSTOMER_VERIFY_BY_CODE = "verify_by_code";
export const CUSTOMER_VERIFY_WITHOUT_CODE = "verify_without_code";
export const CUSTOMER_REGENERATE_VERIFY_CODE = "regenerate_verification";
export const CUSTOMER_VERIFICATION_TYPES = {
	[CUSTOMER_VERIFY_BY_CODE] : "Verify by code",
	[CUSTOMER_VERIFY_WITHOUT_CODE] : "Force verification without code",
	[CUSTOMER_REGENERATE_VERIFY_CODE] : "Regenerate verification with code",
};

/** use to confirm order status*/
export const ORDERS_RULES_STATUS = {
	["is_delayed_acceptance"] : "Delayed Acceptance",
	["is_delayed_picked_up_by_customer"] : "Delayed Pickup By Customer",
	["delayed_pickup_by_restaurant"] : "Delayed Pickup By Restaurant",
	["is_delayed_pickup_by_captain"] : "Delayed Pickup By Captain",
	["is_delayed_preperation"] : "Delayed Preperation",
	["is_delayed_delivery"] : "Delay In Delivery",
};

/** Sms templates type */
export const SMS_TEMPLATE_FOR_USER_REGISTRATION = 1;
export const SMS_TEMPLATE_FOR_FORGOT_PASSWORD = 2;
export const SMS_TEMPLATE_FOR_RESEND_OTP = 3;
export const SMS_TEMPLATE_FOR_UPDATE_MOBILE_NUMBER_EDIT_PROFILE = 4;
export const SMS_TEMPLATE_FOR_SENT_OTP_RECLAIM_VERIFICATION = 5;

export const REPORT_NEW_CUSTOMER = "new_customer";
export const REPORT_ALL_CUSTOMER = "all_customer";
export const REPORT_CUSTOMER_TYPE = {
	[REPORT_NEW_CUSTOMER] : "Only New Customers",
	[REPORT_ALL_CUSTOMER] : "All Customers",
};

/** used in average item unit sold mom report*/
export const MIN_YEAR_FOR_REPORT = 2017;

/** Constant for amount range filter in offer only customer*/
export const ZERO_TO_TWO = '0_to_2_kd';
export const THREE_TO_FIVE = '3_to_5_kd';
export const SIX_TO_TEN = '6_to_10_kd';
export const GREATER_THAN_TEN = 'greater_than_10_kd';
export const NET_AMOUNT_FILTER = {
	[ZERO_TO_TWO] : "0-2 KD",
	[THREE_TO_FIVE] : "2-5 KD",
	[SIX_TO_TEN] : "6-10 KD",
	[GREATER_THAN_TEN] : "> 10 KD",
};

/** Restaurant thermal layout */
export const THERMAL_LAYOUT = "thermal";
export const A4_LAYOUT = "a4";
export const THERMAL_LAYOUT_FORMAT = {
	[THERMAL_LAYOUT] : "Thermal",
	[A4_LAYOUT] : "A4",
};

/** Use in customer segmentation report*/
export const TOP_TEN = 'top_10';
export const TOP_FIFTY = 'top_50';
export const TOP_HUNDRED = 'top_100';
export const TOP_CUSTOMER_FILTER = {
	[TOP_TEN] : "Top 10",
	[TOP_FIFTY] : "Top 50",
	[TOP_HUNDRED] : "Top 100",
};

/** Use in customer churn report*/
export const COUNT_BASIS = 'count_basis';
export const HIGH_VALUE_ORDER = 'high_value_order';
export const SINGLE_ORDER_CUSTOMER = 'single_order';
export const CHURN_REPORTS = {
	[COUNT_BASIS] : "Order Count basis",
	[HIGH_VALUE_ORDER] : "High Value 1st Order Customer",
	[SINGLE_ORDER_CUSTOMER] : "Single order Customers",
};

export const HIGH_VALUE_ORDER_AMOUNT = 8;

/** Use in customer churn report as order count filter*/
export const ZERO_TO_ONE_ORDER = '0_to_1';
export const TWO_TO_FOUR_ORDER = '2_to_4';
export const FIVE_TO_NINE_ORDER = '5_to_9';
export const MORE_THAN_TEN_ORDER = 'more_than_10';
export const ORDER_COUNT_FILTER = {
	[ZERO_TO_ONE_ORDER] : "0-1",
	[TWO_TO_FOUR_ORDER] : "2-4",
	[FIVE_TO_NINE_ORDER] : "5-9",
	[MORE_THAN_TEN_ORDER] : "10 Or More",
};

/** Use in customer churn report*/
export const BUYERS_CRAVEZ_DELIVERY = 'cravez_delivery';
export const BUYERS_RESTRAUNT_DELIVERY = 'rest_delivery';
export const FREE_DELIVERY_CUSTOMERS = 'free_delivery';
export const SINGLE_REST_CUSTOMERS = 'single_restaurant';
export const WEEKEND_BUYERS = 'weekend_buyers';
export const DEC_MONTHLY_ORDERS = 'monthly_orders';
export const BOG_OFFER_CUSTOMERS = 'offer_buyers';
export const CUSTOM_REPORT_TYPES = {
	[BUYERS_CRAVEZ_DELIVERY] : "Buyers - Cravez delivery",
	[BUYERS_RESTRAUNT_DELIVERY] : "Buyers – Restaurant delivery",
	[FREE_DELIVERY_CUSTOMERS] : "Free Delivery customers",
	[SINGLE_REST_CUSTOMERS] : "Single Restaurant customers",
};

/** Ranking Dropdown  */
export const TOP_5 = 5;
export const TOP_10 = 10;
export const TOP_20 = 20;
export const RANKING_DROPDOWN = {
	[TOP_5] : "Top 5",
	[TOP_10] : "Top 10",
	[TOP_20] : "Top 20",
};

/** Sale filter Dropdown  */
export const SALE_SHARE_BY_RESTAURANT = 'restaurant';
export const SALE_SHARE_BY_AREA = 'area';
export const SALE_FILTER_DROPDOWN = {
	[SALE_SHARE_BY_RESTAURANT] : "Filter By Restaurant",
	[SALE_SHARE_BY_AREA] : "Filter By Area",
};

/** avg basket size report type */
export const MONTH = "month";
export const YEAR = "year";

export const REPORT_TYPE = {
	[YEAR] : "Yearly",
	[MONTH] : "Monthly",
};

/** Cancel reason for top contribution report */
export const UNAVAILABLE_ITEMS = "5efc214475154e3d551cc9e7";
export const SHORTAGE_OF_DELIVERY_DRIVER = "5efc2122ad8abb1cfa49f04f";
export const NO_RESPONSE_FROM_RESTAURANT = "5efc20398a38461de533a0f7";
export const WRONG_ORDER_BY_CRAVEZ = "5efc1dc056c8001d05420534";

export const REPORT_CHART_MONTH_NAMES = {
	1: 'Jan',
	2: 'Feb',
	3: 'Mar',
	4: 'Apr',
	5: 'May',
	6: 'Jun',
	7: 'July',
	8: 'Aug',
	9: 'Sep',
	10: 'Oct',
	11: 'Nov',
	12: 'Dec',
};

/** Acceptable fail rate percentage*/
export const TOTAL_ACCECPTABLE_RATE = 4;

/**cancel reason */
export const FAILING_TO_PUNCH_THE_ORDER = "5efc1f20bc25110e0f2aafe8";
export const DELAY_DELIVERY = "5efc1e4d3d682206fc09f656";
export const WRONG_ADDRESS_BY_CUSTOMER = "5efc1ca3d2edcf28fc561453";
export const MOBILE_SWITCHED_OFF = "5efc1bf081f431055a648524";
export const DUPLICATE_ORDER = "5efc1a6bea1dbd250876e103";
export const CHANGED_MIND = "5efc19e93d682206fc09f653";
export const CHANGED_MIND_AT_DELIVERY = "5efc19a2cea700330b1da405";

/**Order posting status */
export const ORDERED = 1;
export const NOT_ORDERED = 0;
export const ORDER_POSTING_STATUS = {
	[ORDERED] : 'Ordered',
	[NOT_ORDERED] : 'Not Ordered',
};

/**push notification status */
export const PN_STATUS = {
	[SENT] : 'Sent',
	[NOT_SENT] : 'Not Sent',
};

/** Driver gps status */
export const DRIVER_GPS_OFF = 0;
export const DRIVER_GPS_ON = 1;

/** Banner slider dropdown  */
export const HOME_BANNER = 'home';
export const BANNER_DROPDOWN = {
	[HOME_BANNER]: "Home"
};

/**areas contribution report type */
export const NO_OF_ORDERS = 'no_of_orders';
export const SALES_VALUE = 'sales_value';
export const DELIVERY_FEES = 'delivery_fees';
export const COMMISSION = 'commission';
export const AREAS_CONTRIBUTION_REPORT_TYPE = {
	[NO_OF_ORDERS] : 'Number of Orders',
	[SALES_VALUE] : 'Sales Value',
	[DELIVERY_FEES] : 'Delivery Fees',
	[COMMISSION] : 'Commission',
};

/**year type */
export const FIRST_HALF = 'first_half';
export const SECOND_HALF = 'second_half';
export const YEAR_TYPE = {
	[FIRST_HALF] : 'First Half',
	[SECOND_HALF] : 'Second Half',
};

/**cravez orders report type */
export const AVG_CHQ_VALUE = 'average_cheque_value';
export const AVG_COMMISSION_PERCENT = 'average_commission_percentage';
export const PAYMENT_METHOD = 'payment_method';
export const CUISINES = 'cuisines';

export const CRAVEZ_ORDERS_REPORT_TYPE = {
	[NO_OF_ORDERS] : 'Number of Orders',
	[SALES_VALUE] : 'Sales Value',
	[AVG_CHQ_VALUE] : 'Average Cheque Value',
	[AVG_COMMISSION_PERCENT] : 'Average Commission Percentage',
	[PAYMENT_METHOD] : 'Payment Method',
	[CUISINES] : 'Cuisines',
};

/** Use in BI & Analytics report filter*/
export const ZERO_TO_SIXTEEN = '0_to_16';
export const SIXTEEN_TO_EIGHTEEN = '16_to_18';
export const EIGHTEEN_TO_TWENTY_THREE = '18_to_23';
export const TWENTY_TWENTY_THREE_TO_TWENTY_EIGHT = '23_to_28';
export const TWENTY_EIGHT_TO_FORTY_TWO = '28_to_42';
export const MORE_THAN_FORTY_TWO = 'more_than_42';

export const AGE_GROUP_FILTER = {
	[ZERO_TO_SIXTEEN] : "0-16",
	[SIXTEEN_TO_EIGHTEEN] : "16-18",
	[EIGHTEEN_TO_TWENTY_THREE] : "18-23",
	[TWENTY_TWENTY_THREE_TO_TWENTY_EIGHT] : "23-28",
	[TWENTY_EIGHT_TO_FORTY_TWO] : "28-42",
	[MORE_THAN_FORTY_TWO] : "42 Or More",
};

/** Ads slider position */
export const POSITION_1 = 1;
export const POSITION_2 = 2;
export const POSITION_3 = 3;
export const POSITION_4 = 4;

export const ADS_POSITION = {
	[POSITION_1] : "Position 1",
	[POSITION_2] : "Position 2",
	[POSITION_3] : "Position 3",
	[POSITION_4] : "Position 4",
};

/**sales staff portfolio report type */
export const SALES_STAFF_PORTFOLIO_REPORT_TYPE = {
	[NO_OF_ORDERS] : 'Orders',
	[SALES_VALUE] : 'Sales',
	[COMMISSION] : 'Commission',
};

/** Previous days to assign order to driver by cron  */
export const PREVIOUS_MAX_DAY_TO_ASSIGN_ORDER_TO_DRIVER = 2;
export const PREVIOUS_MAX_DAY_TO_UPDATE_REMAINING_PREPARATION_TIME_IN_ORDERS = 3;

/** Slab limit to hide add button  */
export const ASSIGNMENT_SLAB_LIMIT = 5;

/** One mile value in km use in convert km into miles  **/
export const ONE_KMS_TO_METER = 1000;

/**Maximum KFC Count**/
export const MAX_KFG_PUSH_LIMIT = 4;

// Regex for validate lat long
export const VALID_LATITUDE_REGEX = /^(-?[1-8]?\d(?:\.\d{1,18})?|90(?:\.0{1,18})?)$/;
export const VALID_LONGITUDE_REGEX = /^(-?(?:1[0-7]|[1-9])?\d(?:\.\d{1,18})?|180(?:\.0{1,18})?)$/;

/** covered area **/
export const CUSTOMIZED = "customized";
export const NOT_CUSTOMIZED = "not_customized";

export const COVERED_AREA_DROPDOWN = {
	[CUSTOMIZED] : "Customized",
	[NOT_CUSTOMIZED] : "Not Customized",
};

/** Driver selection dropdown **/
export const EXCLUSIVE = "exclusive";
export const PRIORITY = "priority";

export const DRIVER_SELECTION_TYPE = {
	[EXCLUSIVE] : "Exclusive",
	[PRIORITY] : "Priority",
};