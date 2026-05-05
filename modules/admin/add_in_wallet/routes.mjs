import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AddInWallet from "./model/add_in_wallet.mjs";
import { addWalletValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure Add in Wallet routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/add_in_wallet';
    const addInWalletModule = new AddInWallet(db);

    // Set views for all /add_in_wallet* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get wallet logs list **/
    router.all(modulePath, checkLoggedInAdmin, (req, res) => {
        addInWalletModule.getWalletList(req, res);
    });

    /** Routing is used to add wallet **/
    router.all(modulePath + "/add", checkLoggedInAdmin, addWalletValidation, validateRequest, (req, res, next) => {
        addInWalletModule.addWallet(req, res, next);
    });
} 