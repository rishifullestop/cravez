import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ImportManager from './model/import_manager.mjs';
import MerchantUpload from './model/merchant_upload.mjs';
import { convertMultipartReqBody} from '../../../utils/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure driver excuses routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/import_managers';
    const merchantUploadModulePath =  '/merchant_upload';

    const importManagerModule = new ImportManager(db);
    const merchantUploadModule = new MerchantUpload(db);

    // Set views for all /import_managers* routes
    router.use([modulePath, merchantUploadModulePath], (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    /** Routing is used to get import managers list **/
    router.all(modulePath,checkLoggedInAdmin,(req, res) => {
        importManagerModule.getImportManagerList(req, res);
    });

    /** Routing is used to update import managers status **/
    router.get(modulePath+"/update-status/:id/:status",checkLoggedInAdmin,(req, res, next) => {
        importManagerModule.updateImportManagerStatus(req, res, next);
    });

    /** Routing is used to download file **/
    router.get(modulePath+"/download/:id",checkLoggedInAdmin,(req, res, next) => {
        importManagerModule.downloadFile(req, res, next);
    });


    /************ Merchant Upload ************/
    
    /** Routing is used to upload merchant file file **/
    router.all(merchantUploadModulePath,checkLoggedInAdmin,(req, res, next) => {
        merchantUploadModule.merchantUpload(req, res, next);
    });

    /** Routing is used render add category page **/
    router.all(merchantUploadModulePath+"/add_category",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addCategory(req, res, next);
    });

    /** Routing is used render add category page **/
    router.all(merchantUploadModulePath+"/add_main_category",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addMainCategory(req, res, next);
    });

    /** Routing is used render add branch page **/
    router.all(merchantUploadModulePath+"/add_branch",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addBranches(req, res, next);
    });
    /** Routing is used render add branch area page **/
    router.all(merchantUploadModulePath+"/add_branch_areas",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addBranchAreas(req, res, next);
    });

    /** Routing is used render add Item Choice Group page **/
    router.all(merchantUploadModulePath+"/add_item_choice_group",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addItemChoiceGroup(req, res, next);
    });

    /** Routing is used render add Item Extra Items page **/
    router.all(merchantUploadModulePath+"/add_item_extra_items",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addItemExtraItems(req, res, next);
    });

    /** Routing is used render add Item page **/
    router.all(merchantUploadModulePath+"/add_item",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addItems(req, res, next);
    });

    /** Routing is used render add menu page **/
    router.all(merchantUploadModulePath+"/add_menu",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addMenu(req, res, next);
    });

    /** Routing is used export data  **/
    router.get(merchantUploadModulePath+"/export_data/:export_id",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.exportData(req, res, next);
    });

    /** Routing is used render add restaurant page **/
    router.all(merchantUploadModulePath+"/add_restaurant",checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        merchantUploadModule.addRestaurant(req, res, next);
    });    
} 