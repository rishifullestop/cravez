import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Cuisines from "./model/cuisines.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import { convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure cuisines routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "cuisines";
    const cuisinesModule = new Cuisines(db);

    // Set views for all /cuisines* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to select cuisines**/
    router.all(modulePath +"/select_cuisines",checkLoggedIn, convertMultipartReqBody,(req, res, next) => {
        cuisinesModule.selectCuisines(req, res, next);
    });

    /** Routing is used to get cuisines list **/
    router.all(modulePath,checkLoggedIn,(req, res, next) => {
        cuisinesModule.getCuisinesList(req, res, next);
    });

    /** Routing is used to get linked tags**/
    router.get(modulePath +"/linked_tags/:cuisine_id",checkLoggedIn,(req, res, next) => {
        cuisinesModule.getLinkedTags(req, res, next);
    });
}