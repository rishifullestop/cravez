import odbcModel from "./model/odbc.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";

/**
 * Configure ODBC routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(app, { db, checkLoggedIn }) {
    const modulePath = FRONT_END_NAME + "odbc";
    const OdbcModule = new odbcModel(db);

	/** Routing is used to get orders list **/
	app.all(modulePath,checkLoggedIn,(req, res,next) => {
		OdbcModule.getAvayaData(req, res,next);
	});
}