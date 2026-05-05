requirejs(['jquery', 'moment', 'daterangepicker'] , function ($, moment) {
	
	$(document).ready(function() {
		
		var options = {};
		//~ options.ranges = {
			//~ 'Today': [moment(), moment()],
			//~ 'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
			//~ 'Last 7 Days': [moment().subtract(6, 'days'), moment()],
			//~ 'Last 30 Days': [moment().subtract(29, 'days'), moment()],
			//~ 'This Month': [moment().startOf('month'), moment().endOf('month')],
			//~ 'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
		//~ };
		options.minDate = MIN_DATE;
		options.locale =  {
			format: DATE_FORMAT
		};		
		options.startDate 	= START_DATE;
		options.endDate		= END_DATE;
		options.opens		= OPENS;
		
		
		$('.daterange_parent-div i').click(function() {
			$('#config-demo').click();
		});
		
		$('#config-demo').daterangepicker(options, function(start, end, label) {
			$('.date_from').val(start.format('YYYY-MM-DD')+" 00:00:00");
			$('.date_to').val(end.format('YYYY-MM-DD 23:59:59'));
			if($('.hotspot_form').length>0){
				$('.hotspot_form').submit();
			}
		});
		$(document).on('click','.page-visit-reset-class',function(){
			$('#config-demo').daterangepicker(options, function(start, end, label) {
				$('.date_from').val(start.format('YYYY-MM-DD')+" 00:00:00");
				$('.date_to').val(end.format('YYYY-MM-DD 23:59:59'));
			});
		});
	});
});
requirejs.config({
    "paths": {
      "jquery": "../jquery1.10.2",
      "moment": "moment",
      "daterangepicker": "daterangepicker"
    }
});
