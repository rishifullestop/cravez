$(function () {
    new Chart(document.getElementById("bar_chart").getContext("2d"), getChartJs());
});

function getChartJs() {
    var config 			= 	null;
    var monthsArray 	=   getPreviousMonths();
   
	$.each(userRecords, function(index,html){
		for(var i=0; i < monthsArray.length; i++) {
			if(typeof html[monthsArray[i]['month_year']] !== typeof undefined){
				monthsArray[i]['total_users'] = (html[monthsArray[i]['month_year']]['total_users']) ? html[monthsArray[i]['month_year']]['total_users'] : 0;
			}
		}
	});

	var months		= [];
	var userCount 	= [];
	for(var i=0; i < monthsArray.length; i++) {
		months.push(monthsArray[i]['name']);
		if(typeof monthsArray[i]['total_users'] !== typeof undefined){
			userCount.push(monthsArray[i]['total_users']);
		}else{
			userCount.push(0);
		}
	}

	config = {
		type: 'bar',
		data: {
			labels: months.reverse(),
			datasets: [
				{
					label: "Users",
					data: userCount.reverse(),
					backgroundColor: 'rgba(233, 30, 99, 0.8)'
				},
			]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			legend: {
				display		:	true,
				fullWidth	: 	true,
				position 	:	"top",
				labels		: 	{
					fontColor: 'rgb(255, 99, 132)'
				}
			},
			scales: {
				yAxes: [{
					ticks: {
						beginAtZero: true,
						userCallback: function(label, index, labels) {
							if (Math.floor(label) === label) {
								return label;
							}
						},
					}
				}],
			}
		},

	};
    return config;
}

function getPreviousMonths(){
    var theMonths = new Array("01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12");
    var theMonthNames = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var today = new Date();

    var aMonth 	= today.getMonth();
    var aYear 	= today.getFullYear();

    var i;
    var monthList = new Array();

    for (i=0; i<12; i++) {
        monthList[i] 				=	{};
        monthList[i]['month_year'] 	=  	theMonths[aMonth]+'-'+aYear;
        monthList[i]['name'] 		=	theMonthNames[aMonth]+' '+aYear;
        aMonth--;
        if (aMonth < 0) {
            aMonth = 11;
            aYear--;
        }
    }
    return monthList;
}
