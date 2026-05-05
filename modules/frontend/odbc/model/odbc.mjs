import odbc from 'odbc';
import { parallel as asyncParallel} from 'async';

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper from "../../../../utils/index.mjs";

export default class FetchAvayaData {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get avaya data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	getAvayaData (req, res,next){
		return new Promise(resolve=>{
			let startDate 	=	Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate 	= 	Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);

			odbc.connect(`DSN=MYDSN`, (error, connection) => {
				if(error) return next(error);

				asyncParallel({
					i_agent_performance_stat_fetch:(callback)=>{
						if(connection == "") return callback(null,null);

						connection.query('SELECT * FROM iAgentPerformanceStat WHERE Timestamp >='+startDate+' AND Timestamp <= '+endDate, (error, result) => {
							callback(error, result || []);
						});
					},
					e_agent_login_stat_fetch:(callback)=>{
						if(connection == "") return callback(null,null);

						connection.query('SELECT * FROM eAgentLoginStat WHERE Timestamp >='+startDate+' AND Timestamp <= '+endDate, (error, result) => {
							callback(error, result || []);
						});
					},
					i_activity_code_stat_fetch:(callback)=>{
						if(connection == "") return callback(null,null);

						connection.query('SELECT * FROM iActivityCodeStat WHERE Timestamp >='+startDate+' AND Timestamp <= '+endDate, (error, result) => {
							callback(error, result || []);
						});
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let iAgentPerformanceStatFetch 	= asyncResponse.i_agent_performance_stat_fetch;
					let eAgentLoginStatFetch	 	= asyncResponse.e_agent_login_stat_fetch;
					let iActivityCodeStatFetch 	 	= asyncResponse.i_activity_code_stat_fetch;

					asyncParallel({
						i_agent_performance_stat_insert:(childCallback)=>{
							if(iAgentPerformanceStatFetch.length <=0) return childCallback(null, null);

							const iAgentPerformanceStat = this.db.collection(Tables.IAGENTPERFORMANCESTAT);
							iAgentPerformanceStat.insertMany(iAgentPerformanceStatFetch).then(()=>{
								childCallback(null, null);
							}).catch(err=>{
								childCallback(err, null);
							});
						},
						e_agent_login_stat_insert:(childCallback)=>{
							if(eAgentLoginStatFetch.length <=0) return childCallback(null, null);

							const eAgentLoginStat = this.db.collection(Tables.EAGENTLOGINSTAT);
							eAgentLoginStat.insertMany(eAgentLoginStatFetch).then(()=>{
								childCallback(null, null);
							}).catch(err=>{
								childCallback(err, null);
							});
						},
						i_activity_code_stat_insert:(childCallback)=>{
							if(iActivityCodeStatFetch.length <=0) return childCallback(null, null);

							const iActivityCodeStat = this.db.collection(Tables.IACTIVITYCODESTAT);
							iActivityCodeStat.insertMany(iActivityCodeStatFetch).then(()=>{
								childCallback(null, null);
							}).catch(err=>{
								childCallback(err, null);
							});
						},
					},(childAsyncErr)=>{
						if(childAsyncErr) return next(childAsyncErr);

						resolve({ status:Constants.STATUS_SUCCESS });
					});
				});
			});
		}).catch(next);
	};
}