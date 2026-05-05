
import * as Constants from "../config/global_constant.mjs";

/**
 *  Function to Round the number
 *
 * @param value		As Number To be round
 * @param precision As Precision
 *
 * @return number
 */
export const round = (value, precision)=>{
	try{
		if(!value || isNaN(value)){
			return value;
		}else{
			precision = (typeof precision != typeof undefined) ? precision :Constants.ROUND_PRECISION;
			var multiplier = Math.pow(10, precision || 0);
			return Math.round(value * multiplier) / multiplier;
		}
	}catch(e){
		return value;
	}
}// end round()

/**
 * Function to format amount
 *
 * @param amount As Amount
 *
 * @return formatted amount
 */
export const currencyFormat=(amount,hideSymbol = false)=>{
	var currencySymbol = (!hideSymbol) ? " "+Constants.CURRENCY_SYMBOL : "";
	if((!amount || isNaN(amount)) && hideSymbol){
		return 0.000;
	}else if(!amount || isNaN(amount)){
		return "0."+"0".repeat(Constants.CURRENCY_ROUND_PRECISION)+currencySymbol;
	}else{
		amount	=	round(amount,Constants.CURRENCY_ROUND_PRECISION);
		amount 	=	amount.toString();
		var afterPoint = '';

		if(amount.indexOf('.') > 0) afterPoint = amount.substring(amount.indexOf('.'),amount.length);
		amount = Math.floor(amount);
		amount = amount.toString();
		var lastThree = amount.substring(amount.length-3);
		var otherNumbers = amount.substring(0,amount.length-3);
		if(otherNumbers != '') lastThree = ',' + lastThree;

		var extraDots = "";
		var remainingDots = 0;

		if(!afterPoint){
			extraDots = ".";
			remainingDots = Constants.CURRENCY_ROUND_PRECISION;
		}else if(afterPoint.length < Constants.CURRENCY_ROUND_PRECISION+1){
			remainingDots = Constants.CURRENCY_ROUND_PRECISION - (afterPoint.length-1);
		}

		if(remainingDots>0) extraDots += "0".repeat(remainingDots);

		return otherNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + lastThree + afterPoint + extraDots + " " +Constants.CURRENCY_SYMBOL;
	}
}