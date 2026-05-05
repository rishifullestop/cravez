/**Function to apply date range picker */
function initDateRangePicker(){
	/**This javascript file is used to pick a date range */
	var minimumDate		= (typeof minDate !== typeof undefined) ? minDate : "";
	var maximumDate		= (typeof maxDate !== typeof undefined) ? maxDate : "";
	var fromDateObj		= $((typeof fromDateInput !== typeof undefined && fromDateInput!="") ? fromDateInput :"#from_date");
	var toDateObj 		= $((typeof toDateInput !== typeof undefined && toDateInput!="") ? toDateInput : "#to_date");
	var configDemo 		= $((typeof datePickerInput !== typeof undefined && datePickerInput!="") ? datePickerInput :
	"#date-range-picker");
	var defaultRanges	= {
		'Today'			: [moment(), moment()],
		'Yesterday'		: [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
		'Last 7 Days'	: [moment().subtract(6, 'days'), moment()],
		'Last 30 Days'	: [moment().subtract(29, 'days'), moment()],
		'This Month'	: [moment().startOf('month'), moment().endOf('month')],
		'Last Month'	: [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
	};

	var customRanges	= (typeof dateRanges !== typeof undefined) ? dateRanges : defaultRanges;
	var stopDataTableDraw	= (typeof stopTableDraw !== typeof undefined) ? stopTableDraw : false;

	/**All the above variables can be overwrite from html page */

	var inputStartDate 	= (fromDateObj.val()) ? fromDateObj.val() : "";
	var inputEndDate 	= (toDateObj.val()) ? toDateObj.val() : "";
	dateFrom			= (typeof dateFrom === typeof undefined || dateFrom || dateFrom =="") 	? inputStartDate : "";
	dateTo				= (typeof dateTo === typeof undefined || dateTo || dateTo =="") 		? inputEndDate   : "";

	/**
	 * For date range picker in searching
	 */
	var START_DATE	= (typeof dateFrom !== typeof undefined && dateFrom!="") ?	new Date(dateFrom) 	: new Date();
	var END_DATE	= (typeof dateTo !==typeof  undefined && dateTo!="" ) ?	new Date(dateTo) : new Date();

	var options		= {};

	/**Options for date range picker*/
	options.locale = {
		format		: 	DATE_RANGE_DATE_FORMAT,
		cancelLabel	:	DATE_RANGE_CANCEL_LABEL
	};

	options.startDate		= START_DATE;
	options.endDate			= END_DATE;
	options.opens			= DATE_RANGE_OPEN_SIDE;
	options.autoUpdateInput	= false;
	if(minimumDate) options.minDate		= new Date(minimumDate);
	if(maximumDate) options.maxDate		= new Date(maximumDate);
	if(customRanges) options.ranges		= customRanges;

	configDemo.prop("readonly",true);
	configDemo.attr("autocomplete","off");
	configDemo.daterangepicker(options);
	$(document).find("li[data-range-key='Custom Range']").trigger("click");

	/**
	* Applying date range filter on user details
	*
	* @param  null
	*
	* @return void
	*/
	configDemo.on('apply.daterangepicker', function(e,picker){
		var startDate	= picker.startDate.format(DATE_RANGE_DISPLAY_FORMAT_FOR_START_DATE);
		var endDate		= picker.endDate.format(DATE_RANGE_DISPLAY_FORMAT_FOR_END_DATE);

		fromDateObj.val(startDate);
		toDateObj.val(endDate);

		var displayStartDate 	= picker.startDate.format(DATE_RANGE_DATE_FORMAT);
		var displayEndDate 		= picker.endDate.format(DATE_RANGE_DATE_FORMAT);
		configDemo.val(displayStartDate+" - "+displayEndDate);

		configDemo.trigger("keyup"); //To write value in local storage
		if(!stopDataTableDraw) dataTable.draw();
	});

	/**
	* Unset date range picker value when click to "clear" button
	*
	* @param  null
	*
	* @return void
	*/
	configDemo.on('cancel.daterangepicker',function(e){
		configDemo.data('daterangepicker').setStartDate(new Date());
		configDemo.data('daterangepicker').setEndDate(new Date());

		fromDateObj.val("");
		toDateObj.val("");
		configDemo.val("");
		configDemo.trigger("keyup"); //To clear localstorage
		if(!stopDataTableDraw) dataTable.draw();
	});
}
initDateRangePicker();
