function initCountDown(){
    /* for time countdown  */
    $('[data-countdown]').each(function() {
        var $this = $(this), finalDate =  new Date($(this).data('countdown'));

        $this.countdown(finalDate, function(event) {
            var totalHours = event.offset.totalDays * HOURS_IN_A_DAY + event.offset.hours;

            $(this).html(event.strftime(totalHours + 'h %-Mm %-Ss'));
            if(totalHours < HOURS_FOR_RED_COUNTER){
                $(this).removeClass("green-timer");
                $(this).addClass("red-timer");
            }

            if(event.elapsed){
                $(this).closest("li").remove();
            }
        });
    });
}