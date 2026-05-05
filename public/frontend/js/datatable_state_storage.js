	var pagePathName = "search_" +(($('form#searchForm').attr("data-listing-url")) ? $('form#searchForm').attr("data-listing-url") : window.location.pathname);

	$(document).ready(function() {
		/* Setting up the local when any changes are made in form */
		var formId = 'searchForm';
		$('form#'+formId).on('keyup change paste', 'input, select, textarea', function(){
			var str = $( '#' + formId).serializeArray();
			localStorage[pagePathName] = 	JSON.stringify(str);
		});
	});

	$(document).ready(function() {
		fillSearchFromLocalStorage();
	});

	/* Filling up the form from the local storage */
	function fillSearchFromLocalStorage(key = null){
		var haveValue = false;
		var nameObj = {};
		$('#searchForm input, #searchForm select, #searchForm textarea').each(function(){
			if($(this).val() && $(this).attr("name")){
				nameObj[$(this).attr("name")] = $(this).val();
				haveValue = true;
			}
		});

		if(localStorage[pagePathName] && typeof localStorage[pagePathName] != 'undefined'){
			searchData	=	JSON.parse(localStorage[pagePathName]);
			if(searchData){
				for(let i = 0; i < searchData.length; i++){
					if(searchData[i]){
						if(key){
							if(key == searchData[i]["name"] && !nameObj[key] ){
								$('[name="'+ searchData[i]["name"]+'"]').val(searchData[i]["value"]);
								haveValue = true;
							}
						}else if(!nameObj[searchData[i]["name"]]){
							$('[name="'+ searchData[i]["name"]+'"]').val(searchData[i]["value"]);
							haveValue = true;
						}
					}
				}

				if($(".bootstrap-select").length >0){
					setTimeout(function(){
					   $(".bootstrap-select select").selectpicker('refresh');
				   },1)
			   }
			}
		}

		if(haveValue && $("input[id^='column_filter_'], select[id^='column_filter_'], textarea[id^='column_filter_']").first().attr("id")){
			$("input[id^='column_filter_'], select[id^='column_filter_'], textarea[id^='column_filter_']").first().trigger("keyup");
			$("input[id^='column_filter_'], select[id^='column_filter_'], textarea[id^='column_filter_']").first().trigger("change");
		}
	}

	/* Calling up the reset function for datatable */
	$(document).on("click","#reset",function(e){
		e.stopImmediatePropagation();
		resetDataTable();
		dataTable.state.clear();

		if($(this).attr("data-href")){
			window.location.href = $(this).attr("data-href");
		}else{
			window.location.reload();
		}
	});

	/**
	* Function for submit data table
	*/
	$(document).on('click','.submit_datatable_form', function(e){
		dataTable.draw();
	});

	/* Resetting the datatable and local storage*/
	function resetDataTable(){
		localStorage.removeItem(pagePathName);
		dataTable.state.clear();

		dataTable.columns().search('');

		/** Reset form **/
		$("#searchForm").find("input,textarea,select").each(function(index,html){
			$(this).val('');
		});

		if($(".bootstrap-select").length >0){
			 setTimeout(function(){
				$(".bootstrap-select select").selectpicker('refresh');
			},1)
		}
	}// end resetDataTable()
