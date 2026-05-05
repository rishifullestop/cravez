/**
 *   Function for Submit form on Enter (Pass Submit Button class in Form data-form-submit-class attribute)
 */
$(document).on('keypress','.on_click_submit',function(e){
	var key = e.which;
	if (key == 13) {
		var className = e.target.className;
		if(className.indexOf('notSubmitOnEnter') < 0){
			if(e.shiftKey == 0 || (e.shiftKey == 1 && $(e.target)[0].type!="textarea")){
				var submitId = $(this).attr('data-submit-btn-id');
				$('#'+submitId).trigger('click');
				return false;
			}
		}
	}
});

/**
 *  For chosen resize function
 *
 **/
$(window).on('resize', resizeChosen);

function resizeChosen() {
   $(".chosen-container").each(function() {
       $(this).attr('style', 'width: 100%');
   });
}

/**
 * Function to change language tabs for multi language form
 *
 * @param selectedLangCode As current selected language
 *
 * @return null
 */
function changeTab(selectedLangCode){
	$('.multilanguage_tab').removeClass('current').addClass('done');
	$('.multilanguage_tab_'+selectedLangCode).removeClass('done').addClass('current');
	$('.multi-lang-tab-pane').removeClass('active');
	$('#multi_lang_'+selectedLangCode).addClass('active');
}//end changeTab()

/**
 *	Function for custom ajax submit
 *
 * 	@param var formId 	As form id for submitting form
 * 	@param var callback As Callback Function
 *
 *	@return null
 */
function ajax_submit(formId,callback){
	var options = {
		success:function(response){
			if(response.status == 'success'){
				callback(true,response);
			}else{
				display_errors(response.message,formId);
				callback(false,response);
			}
		},
		resetForm:false
	};
	$("form#"+formId).ajaxSubmit(options);
}//end ajax_submit()

/**
 *	Function for custom ajax submit for multipart form data with multilevel array
 *
 * 	@param var formId as form id for submitting form
 * 	@param var callback for callback function
 *
 *	@return null
 */
function submit_multipart_form(formId,callback){
	/** take all form input values in Object format */
	var formData	= $('#'+formId).serializeObject();

	/** FormData is used to submit multipart/form-data */
	var fd 			= new FormData();
	if(formData != undefined){
		$.each(formData,function(key,value){
			/** Append all input values into FormData object */
			if(typeof value == 'object'){
				fd.append(key, JSON.stringify(value));
			}else{
				fd.append(key, value);
			}
		});
	}

	/** Form data is used to submit multipart/form-data */
	var fileData	= $('input[type="file"]');
	if(fileData != undefined){
		$.each(fileData,function(key,value){
			if(value.files[0]!= undefined){
				var name = (value.name) ? value.name : '';
				if(value.multiple != undefined && value.multiple != false){
					var filesValue = (value.files) ? value.files : '';
					$.each(filesValue,function(keyFile,valueFile){
						fd.append(name+"["+keyFile+"]", valueFile);
					});
				}else{
					var filesValue = (value.files[0]) ? value.files[0] : '';
					fd.append(name, filesValue);
				}

				/** Append all file input values into FormData object */
			}
		});
	}
	// var currentUrl = (window.location && window.location.href) ? window.location.href : '';
	var currentUrl = ($('#'+formId).attr("action")) ? $('#'+formId).attr("action") :((window.location && window.location.href) ? window.location.href : '');
	var options = {
		url: currentUrl,
		type: "POST",
		data : fd,
		processData : false,
		contentType : false,
		success:function(response){
			if(response.status == 'success'){
				callback(true,response);
			}else{
				display_errors(response.message,formId);
				callback(false,response);
			}
		}
	};
	$.ajax(options);
}//end submit_multipart_form()

/**
 *	Function for display validation errors
 *
 * 	@param var errors As Array or errors
 * 	@param var formId As Form id for display errors
 *
 *	@return null
 */
function display_errors(errors,formId){
	$firstError = '';
	$('#'+formId+' span.error').html('');
	$('#'+formId).find('.form-line').removeClass('error');
	var animateElement = $('#'+formId).closest(".modal").attr("id");
	if(!animateElement) animateElement = "html,body";
	else animateElement = "#"+animateElement;
	if(typeof errors == "object"){
		try{
			$.each(errors,function(index,html){
				if(html.param == 'invalid-access'){
					notice('error',html.msg);
				}else{
					var errorId = html.param;
					if($firstError == ''){
						$firstError = errorId;
					}
					$('#'+formId+' #'+errorId+'_error').prev('.form-line').addClass('error');
					$('#'+formId+' #'+errorId+'_error').html(html.msg).show();
				}
			});
		}catch(e){
			notice('error','Something went wrong, Please try again.');
		}
	}else{
		notice('error',errors);
	}

	if($firstError != ''){
		var scrollTopId = '#'+$firstError;
		if($firstError != 'user-defined-notice'){
			if($('#'+$firstError+'_error').length > 0){
				$('#'+$firstError+'_error').focus();
			}
			scrollTopId = '#'+formId+' #'+$firstError+'_error';
		}
		if($(scrollTopId).length > 0){
			$(animateElement).animate({scrollTop: $(scrollTopId).offset().top - 150}, "slow");
		}
	}
}//end display_errors()

/**
 * Function For For notification messages
 *
 *	@param title 	as Title
 *  @param message 	as Notification Message
 *  @param type 	as Type ('success'/'error'/'info')
 *
 *  @return null
 */
function notice(type,message,timeout,displayPosition,showHideTransition){
	displayPosition 	= (displayPosition == "undefined") ? displayPosition : "top-right";
	showHideTransition 	= (showHideTransition == "undefined") ? showHideTransition : "fade";
	timeout 			= (timeout == "undefined") ? timeout : 10000;

	if (message != "" && message != undefined && typeof message ==  "string") {
		$.toast().reset('all');

		if(typeof position !== typeof undefined && position){
			displayPosition = position;
		}
		var bgColor = "#4CAF50";
		if(type == "error"){
			bgColor = "#E91E63";
		}
		$.toast({
			text: message,
			icon: !1,
			showHideTransition: showHideTransition,
			allowToastClose: !0,
			hideAfter: timeout,
			bgColor: bgColor,
			textColor: '#ffffff',
			stack: !1,
			position: displayPosition,
			textAlign: 'left',
			loader: !1,
			loaderBg: '#E91E63',
		});
	}
}// end notice()

// function notice(type,message,timeout){
// 	timeout = (timeout) ? timeout : 1000000;
// 	$class 	= '';
// 	switch(type){
// 		case 'error':
// 			$class = 'bg-pink';
// 		break;
// 		case 'success':
// 			$class = 'bg-green';
// 		break
// 	}
// 	$html = '<div class="alert '+$class+' alert-dismissible" role="alert">\
// 				<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">×</span></button>\
// 				'+message+'\
// 			</div>';
// 	if(type=="error"){
// 		$('#user-defined-error-notice').html($html).show();
// 		if($('#user-defined-error-notice').length > 0){
// 			$("html,body").animate({scrollTop: $('#user-defined-error-notice').offset().top - 150}, "slow");
// 		}
// 		if(timeout != 0){
// 			setTimeout(function(){
// 				$('#user-defined-error-notice').fadeOut(500,function(){
// 					$('#user-defined-error-notice').html('');
// 				});
// 			},timeout);
// 		}
// 	}
// 	if(type=="success"){
// 		$('#user-defined-notice').html($html).show();
// 		if($('#user-defined-notice').length > 0){
// 			$("html,body").animate({scrollTop: $('#user-defined-notice').offset().top - 150}, "slow");
// 		}
// 		if(timeout != 0){
// 			setTimeout(function(){
// 				$('#user-defined-notice').fadeOut(500,function(){
// 					$('#user-defined-notice').html('');
// 				});
// 			},timeout);
// 		}
// 	}
// }// end notice()

/**
 * Function to show confirm box
 *
 * @param type		As Type of mesage
 * @param title		As Title of comfirm Box
 * @param message	As Confirmation message
 * @param callback  As Callback function
 *
 * @return null
 */
var timer;
function confirmBox(type,title,message,callback){
	clearTimeout(timer);
	swal({
		title: title,
		text: message,
		type: type,
		showCancelButton: true,
		confirmButtonColor: "#DD6B55",
		confirmButtonText: "Ok",
		closeOnConfirm: false,
		showLoaderOnConfirm: true,
	}, function (res) {
		callback(res);
	});
}//end confirmBox()

/**
 * Function to show success message
 *
 * @param type		As Type of mesage
 * @param title 	As Title of comfirm Box
 * @param message	As Confirmation message
 *
 * @return null
 */
function popup_success(type,title,message){
	swal(title, message, type);
	timer = setTimeout(function(){
		swal.close();
	},3000);
}//end popup_success()

/**
 * Function to show html popup message
 *
 * @param type		As Type of mesage
 * @param title 	As Title of comfirm Box
 * @param message	As Confirmation message
 *
 * @return null
 */
function html_popup_success(type,title,message,timerCount){
	swal({
		type : type,
		title: title,
		text: message,
		html: true
	});
	timer = setTimeout(function(){
		swal.close();
	},timerCount);
}//end html_popup_success()

/**
 * This funciton in used replace submit button with loading button
 *
 * @params buttonId = Button Id
 *
 * @return null
 **/
function startTextLoading(buttonId){
	$('#'+buttonId).button('loading');
}//end startTextLoading()

/**
 * This funciton in used replace loading button with submit button
 *
 * @params buttonId = Button Id
 *
 * @return null
 **/
function stopTextLoading(buttonId){
	$('#'+buttonId).button('reset');
	setTimeout(function(){
		$('#'+buttonId+' .waves-ripple').remove();
	},1);
}//end stopTextLoading()

/**
 * This funciton in use to update all ckeditor's value in it's textarea element
 *
 * @params void
 *
 * @return null
 **/
function updateCkeditorValue(){
	for (instance in CKEDITOR.instances) {
		CKEDITOR.instances[instance].updateElement();
	}
}//end updateCkeditorValue()

/**
 * This funciton in used to set date time format using moment js
 *
 * @params void
 *
 * @return null
 **/
function setDateTimeformat(){
	$('.setDateTimeFormat').each(function(){
		var dateTime 		= ($(this).attr('data-timestamp')) ? parseInt($(this).attr('data-timestamp')) : $(this).attr('data-date-time');
		var dateTimeFormat 	= ($(this).attr('data-time-format')) ? $(this).attr('data-time-format') : DATATABLE_DATE_TIME_FORMAT;
		var newTime 		= (dateTime) ? moment(dateTime).tz(DEFAULT_TIME_ZONE).format(dateTimeFormat) : "N/A";
		$(this).text(newTime);
	});
}//end setDateTimeformat()
setDateTimeformat();

/**
 * This funciton in used to replace \n tag with br tag
 *
 * @params void
 *
 * @return null
 **/
function nl2br(html){
	if(html){
		return html.replace(/\n/g, "<br />");
	}else{
		return html;
	}
}//end nl2br()
nl2br();


/**
 *  Function for Confirmation message
 */
$(document).on('click', '.confirm_box', function(e){
	e.stopImmediatePropagation();
	url 				= $(this).attr('data-href');
	confirmMessage 		= $(this).attr('data-confirm-message');
	confirmHeading 		= $(this).attr('data-confirm-heading');
	confirmBox("warning",confirmHeading,confirmMessage,function(result){
		if(result) window.location.replace(url);
	});
	e.preventDefault();
});

/**
 *  Read more text
 **/
function readMore(){
	// Configure/customize these variables.
	var defaultChar 	= 100;  // default characters value
	var ellipsestext 	= "...";
	var moretext 		= "Read more »";

	$('.readmore').each(function() {
		if(!($(this).hasClass("readmore_imported"))){
			showChar = ($(this).attr('data-content-length')) ? $(this).attr('data-content-length') : defaultChar;
			var content = $(this).html();
			if(content.length > showChar) {
				var c = content.substr(0, showChar);
				var html = c + '<span class="moreellipses">' + ellipsestext+ '&nbsp;</span><span class="morecontent"><span>' + content + '</span>&nbsp;&nbsp;<a href="" class="morelink">' + moretext + '</a></span>';
				$(this).addClass('readmore_imported');
				$(this).html(html);
			}
		}
	});

	$(".morecontent span").hide();
}// end readMore()

/**
 *  Call read more function
 *
 **/
readMore();

/**
 * Show and hide text
 **/
$(document).on('click',".morelink",function(e){
	// $("#read_more_content_popup .modal-body").html($(this).prev("span").html())
	// $("#read_more_content_popup").modal("show");
	var readMoreHtml = $(this).prev("span").html();
	if($(this).parent(".morecontent").closest(".readmore_imported").attr("data-content-class")){
		let tmpClass= $(this).closest(".readmore_imported").attr("data-content-class");
		if($("."+tmpClass).length >0 && $("."+tmpClass).html()){
			readMoreHtml = $("."+tmpClass).html();
		}
	}
	$("#read_more_content_popup .modal-body").html(readMoreHtml)
	$("#read_more_content_popup").modal("show");
	return false;
});

/**
 *   Function for socket requests to users
 */
if(SOCKET_ENABLE && typeof io !== typeof undefined){
	var client = io.connect(WEBSITE_SOCKET_URL, {'transports': ['websocket']});
	client.on('connect',function (data) {
		console.log("connect")
		client.emit('login', {id: encryptionKey, type: encryptionType});
	});
}

/* If user logged in */
if(typeof encryptionKey !== typeof undefined){
	/**Get Notification Counter*/
	function getHeaderNotificationCounter(){
		$.ajax({
			url : WEBSITE_ADMIN_URL+'notifications/get_header_notifications_counter',
			type: "POST",
			success:function(response){
				/**Notification conter*/
				var notificationCounter = (response.counter) ? response.counter : 0;
				if(notificationCounter){
					if(notificationCounter > 1000){
						notificationCounter = "1000+";
					}
					$("#notificationCounter").text(notificationCounter);
					$("#notificationCounter").removeClass("hide");
				}else{
					$("#notificationCounter").text("");
					$("#notificationCounter").addClass("hide");
				}
			}
		});
	};//End getHeaderNotificationCounter()

	/** Function to get header notification*/
	var isNotificationsLoaded = false;
	function getHeaderNotificaions(){
		if(!isNotificationsLoaded){
			isNotificationsLoaded = true;
			// put loader
			$("#notificationList").html('<li class="text-center"><a href="javascript:void(0);" class="waves-effect waves-block not_anchor"><div class="menu-info"><img src="'+WEBSITE_ADMIN_IMG_URL+'pagination_loader.gif"/> </div></a></li>');
			$("#viewAllNofication").hide();
			$.ajax({
				url : WEBSITE_ADMIN_URL+'notifications/get_header_notifications',
				type: "POST",
				success:function(response){
					if(response){
						$("#notificationList").html("");
						if(typeof response.result !== typeof undefined && response.result && response.result.length > 0){
							var notificationList = (response.result) ? response.result : [];
							notificationList.map(function(notification){
								var notificaionUrl 	= (notification.url) 			?	notification.url 	   	:"javascript:void(0);";
								var unseenClass 	= (notification.is_seen != 1) 	? 	"unseen_notification" 	:"";
								var notificaionTime = (notification.created) 		? 	notification.created 	:"";
								var notificaionMsg 	= (notification.message) 		?	notification.message 	:"";

								// if(notificaionMsg.length > 38){
								// 	notificaionMsg 	= notificaionMsg.substr(0, 38)+'...';
								// }

								//Append html
								var notifictioanLi = '<li>'+
									'<a href="'+notificaionUrl+'" class="waves-effect waves-block '+unseenClass+'">'+
										'<div class="menu-info">'+
											'<h4 class="font-weight-normal">'+notificaionMsg+'</h4>'+
											'<p>'+
												' <span class="setDateTimeFormat" data-date-time="'+notificaionTime+'"></span>'+
											'</p>'+
										'</div>'+
									'</a>'+
								'</li>';
								$("#notificationList").append(notifictioanLi);
								$("#viewAllNofication").show();
							});
							setDateTimeformat(); //to show dates
						}else{
							/**No record found */
							var notifictioanLi = '<li class="text-center">'+
								'<a href="javascript:void(0);" class="waves-effect waves-block not_anchor">'+
									'<div class="menu-info">'+
										'<h4 class="no_record_text">You do not have any notification.</h4>'+
									'</div>'+
								'</a>'+
							'</li>';
							$("#notificationList").append(notifictioanLi);
						}
						$("#notificationCounter").text("");
						$("#notificationCounter").addClass("hide");
					}
				}
			});
		}else{
			$("#notificationCounter").text("");
			$("#notificationCounter").addClass("hide");
			return false;
		}
	};//End getHeaderNotificaions()

	$( document ).ready(function() {
		// setTimeout(function(){
			// getHeaderNotificationCounter();//get notification counter
		// }, 10000);
	});

	if(SOCKET_ENABLE){		
		/**
		 * Function to get new notificaion and update counter
		 */
		client.on("notification_received",function(data){			
			isNotificationsLoaded = false;
			// getHeaderNotificationCounter();//get counter
			showDesktopNotification(data);
		});
	}

	/**
	 *  Function to round number
	 */
	function customRound(value, precision){
		try{
			if(!value || isNaN(value)){
				return value;
			}else{
				precision 		= 	(typeof precision != typeof undefined && precision) ? precision :ROUND_PRECISION;
				var multiplier 	= 	Math.pow(10, precision || 0);
				return Math.round(value * multiplier) / multiplier;
			}
		}catch(e){
			return value;
		}
	}//end customRound();

	/**
	 *  Function to convert numeric value in number format (like 3000 => 3,0000)
	 *
	 * @param value as a numeric value
	 *
	 * @return numeric value after convert format
	 */
	function numberFormat(value){
		if(!value || isNaN(value)){
			return value;
		}else{
			value	=	round(value,ROUND_PRECISION);
			value 	=	value.toString();
			var afterPoint = '';

			if(value.indexOf('.') > 0) afterPoint = value.substring(value.indexOf('.'),value.length);
			value = Math.floor(value);
			value =	value.toString();
			var lastThree = value.substring(value.length-3);
			var otherNumbers = value.substring(0,value.length-3);
			if(otherNumbers != '') lastThree = ',' + lastThree;
			return  otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree + afterPoint;
		}
	}// end numberFormat()
}

/**
* This funciton in used to generate a link for user id according to roles
*
* @params userName as User Name
* @params userId as User Id
* @params userRoleId as User Role
*
* @return html
**/
function generateUserLink(userName,userId,userRoleId,userType){
	var html = "";
	if((userName!="" && userId != "" && userRoleId!="" && userType) && (userRoleId == FRONT_USER_ROLE_ID || userRoleId == FRONT_USER_ROLE_ID)){
		html = '<a href="'+WEBSITE_ADMIN_URL+"users/"+userType+"/view/"+userId+'" target="_blank">'+userName+'</a>'
	}else{
		if(userName != ""){
			html = userName;
		}else{
			html = "N/A";
		}
	}
	return html;
}//end generateUserLink()

/**
 * Function To Show Element using effect
 *
 * @params id As Element Id
 *
 * return null
 */
function showElementWithEffect(id){
	var r =	"255";
	var g = "255";
	var b = "223";
	var i = 0;
	setTimeout(function(){
		var startEffect = window.setInterval(function(){
			$('#'+id).attr('style','background:rgba('+r+','+g+','+b+','+i+')');
			i = i+0.1;
			if(i>=1){
				clearInterval(startEffect);
				revertElementColor(id,r,g,b);
			}
		},100);
	},100);
}// end showElementWithEffect()

/**
 * Function To revert element Color as default color
 *
 * @params id As Element Id
 *
 * return null
 */
function revertElementColor(id,r,g,b){
	var j = 1.0;
	var revertColor = window.setInterval(function(){
		$('#'+id).attr('style','background:rgba('+r+','+g+','+b+','+j+')');
		j = j-0.1;
		if(j<=0.9){
			$('#'+id).removeAttr('style');
			clearInterval(revertColor);
		}
	},100);
}// end revertElementColor()

/**
 * Fetch data function is used to fetch data using ajax request
 * url is used for ajax url and admin url is used to replace current url, like if current url is /restaurants and if i select any restarurant like restaurant-1 in that case admin url is /restaurants/restaurant-1
 */
function fetchData(){
	var selectorId 	= "main-container";
	var self		= $("#"+selectorId);
	var url  		= self.data("url");
	var adminUrl	= self.data("restaurant-url");
	var isModal		= self.data("open-modal");
	var modalId		= self.data("modal-id");
	var container	= self.data("container");
	var sameTabHtml	= self.data("same-tab-html");

	modalId 	= isModal ? ((modalId) ? modalId : "form_modal") : "";
	if(adminUrl) window.history.replaceState(null, null, adminUrl);
	if(url){
		// var oldHtml = "";
		// if(modalId){
		// 	var loaderHtml = '<div class="row clearfix">\
		// 		<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">\
		// 			<div class="modal-dialog modal-dialog-centered modal-lg" role="document">\
		// 				<div class="modal-content">\
		// 					<div class="modal-header text-center loader-on-page">\
		// 						<img src="'+WEBSITE_IMG_URL+'cravez_loader.gif" alt="Loading..">\
		// 					</div>\
		// 				</div>\
		// 			</div>\
		// 		</div>\
		// 	</div>'
		// 	$("#"+modalId).html(loaderHtml).modal("show");
		// }else if(container){
		// 	var loaderHtml = '<div class="row">\
		// 		<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">\
		// 			<div class="body text-center loader-on-page">\
		// 				<img src="'+WEBSITE_IMG_URL+'cravez_loader.gif" alt="Loading..">\
		// 			</div>\
		// 		</div>\
		// 	</div>';
		// 	oldHtml = $("#"+container).html();
		// 	$("#"+container).html(loaderHtml);
		// }else{
		// 	var loaderHtml = '<div class="row clearfix">\
		// 		<div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">\
		// 			<div class="card">\
		// 				<div class="header text-center loader-on-page">\
		// 					<img src="'+WEBSITE_IMG_URL+'cravez_loader.gif" alt="Loading..">\
		// 				</div>\
		// 			</div>\
		// 		</div>\
		// 	</div>';
		// 	oldHtml = $("#"+container).html();
		// 	$("#main-container").html(loaderHtml);
		// }

		var options = {
			url 	: url,
			method	: "GET"
		};
		ajaxRequest(options,function(response){
			if(response.status == 400){
				if(sameTabHtml){
					$("#"+container).html($("."+sameTabHtml).html()).removeClass("hideMe");
				}else{
					var responseJSON 	=	(response && response.responseJSON) ? response.responseJSON :{};
					var message 		= 	(responseJSON.message) ? responseJSON.message : "";
					if(message) notice("error",message);

					if(responseJSON.redirect_url){
						window.location.href = responseJSON.redirect_url;
					}
					
					// if(isModal && modalId){
					// 	$("#"+modalId).modal("hide");
					// }else if(container){
					// 	$("#"+container).html(oldHtml);
					// }else{
					// 	$("#main-container").html(oldHtml);
					// }
				}
			}else{
				if(isModal && modalId){
					$("#"+modalId).html(response).modal("show");
					if($("#"+modalId).find(".modal-header h2 .modal-close").length == 0) $("#"+modalId).find(".modal-header h2").append('<span class="cursor-pointer modal-close pull-right" data-dismiss="modal"><i class="material-icons">close</i></button>');
				}else if(container){
					$("#"+container).html(response);
				}else{
					$("#main-container").html(response);
				}
			}
			//~ headerCheck();
		});
	}
}

/* Event triggered when any link with action button class clicked */
$(document).on('click','.action-btn',function(e){
	e.preventDefault();

	var selectorId = "main-container";

	var type		= $(this).data("type");
	var isModal 	= $(this).data("open-modal");
	// var url			= $(this).attr("href");
	var url			= $(this).attr("data-action-url") ? $(this).attr("data-action-url") : $(this).attr("href");
	var adminUrl	= $(this).data("restaurant-url");
	var container 	= $(this).data("container");
	var sameTabHtml	= $(this).data("same-tab-html");
	var modalId		= $(this).data("modal-id");	

	$("#"+selectorId).data("selected-type",type)
						.data("open-modal",(isModal) ? true : false)
						.data("url",url)
						.data("restaurant-url",adminUrl)
						.data("container",(container) ? container : "")
						.data("same-tab-html",(sameTabHtml) ? sameTabHtml : false)
						.data("modal-id",(modalId) ? modalId : "form_modal");
	fetchData();
});

/** Stop backgroud scroll when close child modal */
$('#form_modal_2, #read_more_content_popup').on("hidden.bs.modal", function (e) { 
	if ($('.modal:visible').length) {
		$('body').addClass('modal-open');
	}
});


/**Function is use to create filestyle elements */
function customFileStyle(){
	var imageBtnHtml = '<div class="jfilestyle jfilestyle-theme-default"><span class="focus-jfilestyle" tabindex="0"><label for="{LABEL_FOR}"><span>{LABEL_TXT}</span> <span class="count-jfilestyle hide"></span></label></span></div>';

	$("input.cfilestyle").each(function(){
		var inputId     = $(this).parent().find("input.cfilestyle").attr("id");
		var inputText   = $(this).parent().find("input.cfilestyle").data("text");
		var labelText	= (inputText) ? inputText : "Select Image";
		var finalInput  = imageBtnHtml.replace("{LABEL_FOR}",inputId).replace("{LABEL_TXT}",labelText);
		$(this).after(finalInput);
		$(this).hide();
	});

	$('input.cfilestyle').change(function(){
		var files = $(this)[0].files;
		var selectedItems = files.length;
		if(selectedItems > 0){
			$(this).parent().find("div.jfilestyle").find(".count-jfilestyle").text(selectedItems);
			$(this).parent().find("div.jfilestyle").find(".count-jfilestyle").removeClass("hide");
		}else{
			$(this).parent().find("div.jfilestyle").find(".count-jfilestyle").addClass("hide");
		}
	});
	$('[data-toggle="tooltip"]').tooltip();
}

function client_side_validation(formId){
	var errorArray = [];
	$("#"+formId).find('input,select,textarea,text').each(function (){
		var type	=	this.type || this.tagName.toLowerCase();
		if(type != 'hidden'){
			var	errorId			=	$(this).attr('data-error-id');

			var	inputName		=	(errorId) ? errorId : $(this).attr('name');
			var	inputType		=	$(this).attr('type');
			var errorMessage	= 	"";
			if(inputName){
				var errorFlag	=	false;
				var val			=	($(this).val()) ?  $(this).val().replace(new RegExp(/&nbsp;|<br \/\>/g),' ').trim() :"";
				if(!val || (val && val.constructor !== Array)){
					val	=	(val) ?	val.trim()	:"";
				}

				if(typeof $(this).attr("data-blank-error-message") != 'undefined'){
					if(inputType == "checkbox"){
						if(!$(this).prop('checked')){
							errorFlag		= true;
							errorMessage	= $(this).attr('data-blank-error-message');
						}
					}else if(val == "" && !$(this).hasClass('novalidate')){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-blank-error-message');
					}
				}

				if($(this).hasClass('novalidate') && val =="") errorFlag	 = true;

				if(!errorFlag && typeof $(this).attr("data-email-error-message") != 'undefined'){
					var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
					if(!regex.test(val)){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-email-error-message');
					}
				}

				if(!errorFlag && typeof $(this).attr("data-pattern-error-message") != 'undefined' && typeof $(this).attr("data-allowed-pattern") != "undefined"){
					var regex = new RegExp($(this).attr("data-allowed-pattern"));
					if(!regex.test(val)){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-pattern-error-message');
					}
				}

				if(!errorFlag && typeof $(this).attr("data-numeric-error-message") != "undefined" && !$.isNumeric(val)){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-numeric-error-message');
				}

				if(!errorFlag && typeof $(this).attr("data-max-length-error-message") != "undefined" && typeof $(this).attr("data-max-length") != "undefined" && val.length > parseInt($(this).attr("data-max-length"))){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-max-length-error-message');
				}

				if(!errorFlag && typeof $(this).attr("data-min-length-error-message") != "undefined" &&typeof $(this).attr("data-min-length") != "undefined" && val.length < parseInt($(this).attr("data-min-length"))){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-min-length-error-message');
				}

				if(!errorFlag && typeof $(this).attr("data-geater-than-zero-error-message") != "undefined" && val <= 0){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-geater-than-zero-error-message');
				}

				if(errorMessage=="" && typeof $(this).attr("data-confirm-error-message") != "undefined"){
					var targetId = $(this).attr('data-confirm-target-id');
					if(val !== $('#'+targetId).val()){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-confirm-error-message');
					}
				}

				if(!errorFlag && typeof $(this).attr("data-allowed-extensions-error-message") != "undefined" && typeof $(this).attr("data-allowed-extensions") != "undefined"){
					var extension = val.split('.').pop().toLowerCase();
					if($(this).attr("data-allowed-extensions").indexOf(extension) === -1){
						errorFlag	 	= 	true;
						errorMessage	=	$(this).attr("data-allowed-extensions-error-message");
					}
				}

				if(errorMessage!=""){
					errorArray.push({msg : errorMessage,param : inputName});
				}
			}
		}
	});

	if(errorArray.length >0){
		display_errors(errorArray,formId);
		return false;
	}else{
		return true;
	}
}//End client_side_validation()


/**
 *  Function to convert currency format
 *
 * @param amount as currency value
 *
 * @return amount after convert currency format
 */
function currencyFormat(amount) {
	if(!amount || isNaN(amount)){
		return "0."+"0".repeat(CURRENCY_ROUND_PRECISION)+ " " + CURRENCY_SYMBOL;
	}else{
		var isNegetive = (amount < 0) ? true : false;
		if (isNegetive) amount = Math.abs(amount);

		amount	=	customRound(amount,CURRENCY_ROUND_PRECISION);
		amount 	=	amount.toString();
		var afterPoint = '';

		if(amount.indexOf('.') > 0) afterPoint = amount.substring(amount.indexOf('.'),amount.length);
		amount = Math.floor(amount);
		amount = amount.toString();
		var lastThree = amount.substring(amount.length-3);
		var otherNumbers = amount.substring(0,amount.length-3);
		if(otherNumbers != '') lastThree = ',' + lastThree;

		var extraDots 		= "";
		var remainingDots 	= 0;

		if(!afterPoint){
			extraDots = ".";
			remainingDots = CURRENCY_ROUND_PRECISION;
		}else if(afterPoint.length < CURRENCY_ROUND_PRECISION+1){
			remainingDots = CURRENCY_ROUND_PRECISION - (afterPoint.length-1);
		}
		if(remainingDots>0) extraDots += "0".repeat(remainingDots);
		if (isNegetive) otherNumbers = "-" + otherNumbers;
		return otherNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + lastThree + afterPoint+ extraDots +" "+CURRENCY_SYMBOL;
	}
}// end currencyFormat()

function currencyFormatOld(amount,hideSymbol = false) {
	var currencySymbol = (!hideSymbol) ? CURRENCY_SYMBOL : "";
	if((!amount || isNaN(amount)) && hideSymbol){
		return 0;
	}else if(!amount || isNaN(amount)){
		return "0."+"0".repeat(CURRENCY_ROUND_PRECISION)+ " " + currencySymbol;
	}else{
		var isNegetive = (amount < 0) ? true : false;
		if(isNegetive)  amount = Math.abs(amount);

		amount	=	customRound(amount,CURRENCY_ROUND_PRECISION);
		amount 	=	amount.toString();
		var afterPoint = '';

		if(amount.indexOf('.') > 0) afterPoint = amount.substring(amount.indexOf('.'),amount.length);
		amount = Math.floor(amount);
		amount = amount.toString();
		var lastThree = amount.substring(amount.length-3);
		var otherNumbers = amount.substring(0,amount.length-3);
		if(otherNumbers != '') lastThree = ',' + lastThree;

		var extraDots 		= "";
		var remainingDots 	= 0;

		if(!afterPoint){
			extraDots = ".";
			remainingDots = CURRENCY_ROUND_PRECISION;
		}else if(afterPoint.length < CURRENCY_ROUND_PRECISION+1){
			remainingDots = CURRENCY_ROUND_PRECISION - (afterPoint.length-1);
		}
		if(remainingDots>0) extraDots += "0".repeat(remainingDots);
		if(isNegetive) otherNumbers = "-"+otherNumbers;
		return otherNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + lastThree + afterPoint+ extraDots +" "+currencySymbol;
	}
}// end currencyFormat()

/**
 *  Function to set 24 hour time format
 *
 * @param time as 24 hour time in float
 *
 * @return 24 hour formatted time
 */
function set24HourFormat(time) {
	try{
		/** AM/Pm Format */
		// var timeData 	= time.toString().split(".");
		// if(timeData.length==1) timeData.push("00");
		// var amPm 		= timeData[0] < 12 ? ' AM' : ' PM'; // Set AM/PM
		// timeData[0] 	= timeData[0] % 12 || 12; 			// Adjust hours
		// if(timeData[0]<10) timeData[0] = "0"+timeData[0];
		// return timeData.join(":")+amPm;

		return parseFloat(time).toFixed(2);
	}catch(e){
		return time;
	}
}// end set24HourFormat()


$(document).on('click','.scroll-to-top',function(e){
	window.scrollTo(0,0);
});

var PNSound = null;
$( document ).ready(function() {
	PNSound 	= document.createElement("AUDIO");
	PNSound.src = WEBSITE_IMG_URL+"swiftly.mp3";
});

function showDesktopNotification(data){
	var notificationBody = {
		body: data.message,
		icon: WEBSITE_IMG_URL+"small-logo.png",
		tag	: data.message
	};

	if (navigator.userAgent.indexOf("Chrome") !== -1){
		notificationBody.icon =  WEBSITE_IMG_URL+"web-pn-logo.png";
	}

	var notify = "";
	if (Notification.permission === "granted") {
		notify = new Notification(siteTitle,notificationBody);
		PNSound.play();

	} else if (Notification.permission !== "denied") {
		Notification.requestPermission().then(function(permission) {
			if(!("permission" in Notification)) {
				Notification.permission = permission;
			}
			if (permission === "granted") {				
				notify = new Notification(siteTitle,notificationBody);
				PNSound.play();
			}
		});
	}
	document.addEventListener('visibilitychange', function() {
		if (document.visibilityState === 'visible') {
			notify.close();
		}
	});

	// notify.onclick = function(event) {
		// if(data.url && data.url != "javascript:void(0);"){
			// event.preventDefault();
			// window.open(data.url, '_blank').focus();
		// }
	// }
}

//~ function headerCheck(){ 

	//~ if($('table').is(':visible') == true){ console.log('have');
		//~ var tableId	=	$('table').attr('id');
		//~ $('#'+tableId).DataTable().fixedHeader.enable();
		//~ customDatatableOptions	=	{
			//~ "fixedHeader"	:	{
				//~ "headerOffset": $('.navbar').outerHeight()
			//~ }
		//~ };
		//~ $.fn.DataTable(customDatatableOptions);
	//~ }else{ console.log('donthave');
		//~ customDatatableOptions	=	{
			//~ "fixedHeader"	:	false
		//~ }
		//~ $.fn.DataTable(customDatatableOptions);

	//~ }
//~ }

$(document).ready(function(){
	$(document).on("click",".custom_sorting", function(e){
		let tableId = $(this).closest('table').attr('id');
		var asc		= $(this).hasClass("asc");
		var desc	= $(this).hasClass("desc");

		$(".custom_sorting").removeClass("asc").removeClass("desc");
		if (desc || (!asc && !desc)) {
			$(this).addClass("asc");
			order="asc";
		} else {
			$(this).addClass("desc");
			order="desc";
		}
		sorting_table($("#"+tableId), order,$(this).index());
	});
});

/** function to sort table*/
function sorting_table(table, order, index){
	var asc   = order === "asc",
	tbody = table.find("tbody");
	tbody.find("tr").sort(function(a, b) {
	   if(index!=0 && index!=4){
			// if column data consist alphabet or string data use this code
			if (asc) {
				return $("td:eq("+index+")", a).text().localeCompare($("td:eq("+index+")", b).text());
			} else {
				return $("td:eq("+index+")", b).text().localeCompare($("td:eq("+index+")", a).text());
			}
		}else{
			// if column data consiste numeric or integer use this code
			if (asc) {
				return $("td:eq("+index+")", a).text()-($("td:eq("+index+")", b).text());
			} else {
				return $("td:eq("+index+")", b).text()-($("td:eq("+index+")", a).text());
			}
		}
	}).appendTo(tbody);
}

/** Break hours into hours or minutes like 12.50 = 12 hours 30 minutes */
function convertHoursIntoHourAndMinute(hours) {
	if(!hours || isNaN(hours) || hours == 0) return 0;

    var rhours      =   Math.floor(hours);
    var minutes     =   (hours - rhours) * 60;
    var rminutes    =   Math.round(minutes);
    var hoursLable  =   (rhours >0) ? rhours+((rhours > 1) ? " Hours "    :" Hour ") :"";
    var minLable    =   (rminutes >0) ? rminutes+((rminutes > 1) ? " Minutes"    :" Minute ") :"";

    return hoursLable+minLable;
}// end convertHoursIntoHourAndMinute()