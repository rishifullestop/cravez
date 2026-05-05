import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PaymentTransaction from "./model/payment_transaction.mjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure payment transaction routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/payment_transaction';
    const paymentTransactionModule = new PaymentTransaction(db);

    // Set views for all /tickets* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get payment transaction list **/
    router.all(modulePath,checkLoggedInAdmin,(req, res,next) => {
        paymentTransactionModule.getPaymentTransactionList(req, res,next);
    });

    /** Routing is used to get customer payment transaction list **/
    router.all(modulePath+"/customer_payment_transaction_list/:user_id",checkLoggedInAdmin,(req, res, next)=>{
        paymentTransactionModule.getCommonPaymentTransactionList(req, res, next);
    });

    /** Routing is used to get order  payment transaction  list **/
    router.all(modulePath+"/order_payment_transaction_list/:order_id",checkLoggedInAdmin,(req, res, next)=>{
        paymentTransactionModule.getCommonPaymentTransactionList(req, res, next);
    });
} 