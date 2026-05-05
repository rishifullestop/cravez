function initCountDown(){
    $('[data-countdown]').each(function() {
        var $this = $(this), finalDate =  new Date($(this).data('countdown'));
		var tzTime= moment.tz(finalDate, DEFAULT_TIME_ZONE);
		var momentDate = moment.tz(new Date(), DEFAULT_TIME_ZONE);
        $this.countdown(tzTime.toDate(), function(event) {
			var startTime   = parseFloat($(this).data("start-time"));
			var currentHrs  = momentDate.toDate().getHours();
			var currentMin  = momentDate.toDate().getMinutes();

			var currentTime = parseFloat(moment(new Date()).tz(DEFAULT_TIME_ZONE).format("HH.mm"));
            if(startTime <= currentTime){
                var totalHours = event.offset.totalDays * 24 + event.offset.hours;
                if(totalHours > 0){
                    $(this).html(event.strftime(totalHours + 'h %-M Min %-S Sec'));
                }else if(event.offset.minutes > 0){
                    $(this).html(event.strftime('%-M Min %-S Sec'));
				}else if(event.offset.seconds >= 0){
                   $(this).html(event.strftime('%-S Sec'));
                }else{
                    $(this).html("0 Min");
                }
                if(event.elapsed){
                    $(this).html("0 Min");
                }
            }else{
				$(this).html("0 Min");
            }
        });
    });

	$('[data-countup]').each(function() {
		var $this	= $(this), finalDate = $(this).data('countup');
		var duration= $(this).data('duration');
		var tzTime	= moment.tz(finalDate, DEFAULT_TIME_ZONE)
		$this.countdown(tzTime.toDate(),{elapse: true}).on('update.countdown', function(event) {
			if (event.elapsed) {
				if(event.offset.totalSeconds < duration){
					if(event.offset.hours > 0){
						$this.html(event.strftime('%-Hh %-M Min %-S Sec'));
					}else if(event.offset.minutes > 0){
						$this.html(event.strftime('%-M Min %-S Sec'));
					}else{
						$(this).html(event.strftime('%-S Sec'));
					}
				}else{
					var elapseMin = duration/60;
					$(this).html(elapseMin+" Min");
				}
			}else {
				$this.html('--:--');
			}
		});
	});
}