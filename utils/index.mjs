export * from './arrayHelper.mjs';
export * from './addressHelper.mjs';
export * from './attributeHelper.mjs';
export * from './authzHelper.mjs';
export * from './branchHelper.mjs';
export * from './dataSanitizer.mjs';
export * from './dataTableHelper.mjs';
export * from './dateHelper.mjs';
export * from './exportHelper.mjs';
export * from './fileHelper.mjs';
export * from './formHelper.mjs';
export * from './generatorHelper.mjs';
export * from './languageHelper.mjs';
export * from './locationHelper.mjs';
export * from './numberHelper.mjs';
export * from './securityHelper.mjs';
export * from './selectBoxHelper.mjs';
export * from './stringHelper.mjs';
export * from './userWalletHelper.mjs';
export * from './ticketHelper.mjs';
export * from './vocHelper.mjs';
export * from './orderHelper.mjs';
export * from './requestHelper.mjs';
export * from './restaturantHelper.mjs';
export * from './driverHelper.mjs';
export * from './customerHelper.mjs';
export * from './masterHelper.mjs';



/**
 * Function to run task parallel
 *
 * @param req	As Request Data
 * @param res	As Response Data
 *
 * @return boolean
 */
export const runTaskParallel = async (promisesObj)=>{
	const entries = Object.entries(promisesObj);
	const results = await Promise.all(entries.map(([, p]) => p));
	return Object.fromEntries(entries.map(([key], i) => [key, results[i]]));
}//End runTaskParallel()

/**
 * Function to use to print data in cmd panel
 *
 * @param message as printable data
 *
 * @return void
 */
export const logger = async (...message)=>{
	const debug	= JSON.parse(process?.env?.DEBUG || 'false');
	if(debug){
		return console.log(...message)
	}else{
		return;
	}
}//End runTaskParallel()