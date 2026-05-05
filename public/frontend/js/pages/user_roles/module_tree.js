/**
 * Function to draw role module tree
 */
function printTree(dataArray,level,parentTag,moduleIdsArray){
    if(level == 0){
        $(parentTag).append('<ul id="main-div"></ul>');
        parentTag	=	"#main-div";
    }
    if(typeof dataArray !== typeof undefined && dataArray.length >0){
        dataArray.map(function(menu,index) {
            var isChecked 	=  "";
            var subModules  =  [];
            if(typeof moduleIdsArray !== typeof undefined){
                moduleIdsArray.map((moduleIdRecords)=>{
                    if(moduleIdRecords.id == menu.id){
                        isChecked  = "checked";
                        subModules = (moduleIdRecords.sub_modules) ? moduleIdRecords.sub_modules : [];
                    }
                });
            }
            /** for first checkbox is alrady checked and not editable **/
            if(level == 0 && index == 0){
                var isChecked = "checked='true' readonly='true' onclick='return false'";
            }
            var ExpendSpan	= '<span title="Expand this branch" class="font-14 collapsed expend-btn"></span>';

            /** labelOne for parent Checkbox **/
            var labelOne 	= '<label class="label label-danger"><input id="AdminRoleModuleId'+menu.id+'Allow" value="'+menu.group_path+'" class="simple-chaeckbox parentCheckbox" name="module_ids['+menu.id+'][module]" type="checkbox" '+isChecked+'> '+menu.name+'</label>';

            /** label for middle child checkbox **/
            var labelTwo 	= '<span class="label label-success"><label><input id="AdminRoleModuleId'+menu.id+'Allow" value="'+menu.group_path+'" class="simple-chaeckbox childCheckbox" name="module_ids['+menu.id+'][module]" type="checkbox" '+isChecked+'> '+menu.name+'</label></span>';

            var label	= (level == 0) ? labelOne : labelTwo;
            var liClass = (level == 0) ? "parent_li no-childrens" : "middle-child";

            /** variables for conditions **/
            let html = '';
            let liExpendSpan = '';

            /** check for childs is available or not for last childs **/
            if(typeof menu.childs == typeof undefined || menu.childs.length == 0 && !( level == 0 && index ==0 )){
                if (typeof menu.slug !== typeof undefined && menu.slug != "" && typeof permissions[menu.slug] !== typeof undefined ) {
                    let lastChilds   = permissions[menu.slug];


                    html += '<ul>';
                    liExpendSpan = ExpendSpan;
                    Object.keys(lastChilds).map((record, childKey)=> {
                        let childChecked = "";

                        if(subModules.indexOf(record) !== -1) childChecked = "checked";
                        if(childChecked && childKey ==0) childChecked += " readonly";

                        /** genrate unique id for checkbox **/
                        let randomId = Math.floor(Math.random() * 10000) + 1;

                        /** genrate li's for list, add, edit and delete checkbox **/
                        html += '<li class=" no-childrens" id="child_level_'+level+'_'+childKey+'" >'+
                                    '<span class="label bg-grey custom-add-edit">'+
                                        '<label class="m-l-0" for="inputCheckbox_'+level+'_'+randomId+'">'+
                                            '<input type="checkbox" id="inputCheckbox_'+level+'_'+randomId+'" value="'+record+'" class="simple-chaeckbox last-child" name="module_ids['+menu.id+'][childs]['+record+']" '+childChecked+' /> '+((lastChilds[record] && lastChilds[record].title) ? lastChilds[record].title : "")+
                                        '</label>'+
                                    '</span>'+
                                '</li>';
                    });
                    html += '</ul>';
                }
            }

            /** append li's in ul's with parent and middle checkboxes **/
            $(parentTag).append('<li class=" '+liClass+'" id="menu_level_'+level+'_'+index+'">'+liExpendSpan+label+html+'</li>');

            /** check for childs is available or not for middle level checkboxes **/
            if(typeof menu.slug !== typeof undefined && menu.slug != "" && typeof permissions[menu.slug] !== typeof undefined){
                $('#menu_level_'+level+'_'+index).removeClass('no-childrens');
            }

            if(typeof menu.childs !== typeof undefined && menu.childs.length > 0){
                var currentLevel = level+1;
                $('#menu_level_'+level+'_'+index).removeClass('no-childrens');
                $('#menu_level_'+level+'_'+index).prepend(ExpendSpan);
                $('#menu_level_'+level+'_'+index).append('<ul id="main-ol-'+level+'-'+index+'"></ul>');
                printTree(menu.childs, currentLevel, '#main-ol-'+level+'-'+index, moduleIdsArray);
            }
        });

        /** for first time hide all childrens **/
        $('#role-menu li.parent_li').find(' > ul > li').hide('fast');
        $('#role-menu li.parent_li li > span.expend-btn').parent('li').find(' > ul > li').hide('fast');
        $('#check_unckeck_row').removeClass("hide");
        $('#module_ids_error').removeClass("hide");

     }
 };//end printTree

/**
 * For expand tree
 */
$('#role-menu li.parent_li').find(' > ul > li').hide('fast');
$(document).on('click','#role-menu li > span.expend-btn', function (e) {
    let children = $(this).parent('li.parent_li').find(' > ul > li');
    if (children.is(":visible")) {
        children.hide('fast');
        $(this).attr('title', 'Expand this branch').addClass('collapsed').removeClass('expended');
    } else {
        children.show('fast');
        $(this).attr('title', 'Collapse this branch').addClass('expended').removeClass('collapsed');
    }
    e.stopPropagation();
});

/**
 * For expand child tree
 */
$(document).on('click','#role-menu li.parent_li li > span.expend-btn', function (e) {
    let children = $(this).parent('li').find(' > ul > li');
    if (children.is(":visible")) {
        children.hide('fast');
        $(this).attr('title', 'Expand this branch').addClass('collapsed').removeClass('expended');
    } else {
        children.show('fast');
        $(this).attr('title', 'Collapse this branch').addClass('expended').removeClass('collapsed');
    }
    e.stopPropagation();
});

/** set childCheckbox actions **/
$(document).on('click','.childCheckbox',function(e){
    let parent = $(this).closest('ul').parent('li');
    let lengthCount = (parent.find('input.childCheckbox:checkbox:checked').length);

    if ($(this).is(":checked")) {
        $(this).closest('li').find('input').prop('checked', true);
        $(this).parents('li').find('input:first').prop("checked",true);
        /** Mark disabled child first checkobx(last-checkbox)  */
        $(this).closest('li').find("input:checkbox.last-child:first").attr("readonly",true);
    }else {
        $(this).closest('li').find("input:checkbox.last-child:first").attr("readonly",false);
        $(this).closest('li').find('input').prop('checked', false);

        /* Uncheck parent checkbox on count of middle checkboxes checked count is 0 */
        if (lengthCount == 0) {
            parent.find('input:first').prop("checked",false);
        }
    }
});

$(document).on('click','.last-child',function(e){
    /* here parent is indicate to list, add, edit and delete buttons parent div */
    let parent = $(this).closest('ul');
    let superParent = parent.parents('li.parent_li');

    /** Check if current checkbox is not first check than remove disabled or mark unchecked of first checkbox */
    if(parent.find("li:first").attr("id") != $(this).closest("li").attr("id")){
        parent.find("input:checkbox:first").prop("checked",false).attr("readonly",false);
    }
    let lengthCount = (parent.find('input:checkbox:checked').length);

    /* Uncheck parent checkbox on count of checked checkboxes is 0 */
    if(lengthCount==0){
        parent.parent().find('input:first').prop("checked",false);
        let middleCheckboxCount = parent.parents('ul').find('input.childCheckbox:checkbox:checked').length;
        if (middleCheckboxCount == 0) {
            superParent.find('input.parentCheckbox:first').prop("checked",false);
        }
        parent.find("input:checkbox:first").attr("readonly",false);
    }else {
        parent.parent().find('input:first').prop("checked",true);
        superParent.find('input:first').prop("checked",true);
        parent.find("input:checkbox:first").prop("checked",true).attr("readonly",true);
    }
});

// Check and Uncheck Checkbox
$(document).on('click','.parentCheckbox',function(e){
    var parent = $(this).closest("li");
    var len = jQuery(parent).find("input:first:checkbox:checked").length;
    if(len == 1){
        jQuery(this).closest('li').find('input').prop("checked",true);
        jQuery(this).closest('li').next('ul').find('input').prop("checked",true);
        jQuery(this).closest('li').find('input.last-child:first').attr("readonly",true);
    }else{
        jQuery(this).closest('li').find('input').prop("checked",false);
        jQuery(this).closest('li').next('ul').find('input').prop("checked",false);
        jQuery(this).closest('li').find('input.last-child:first').attr("readonly",false);
    }
});

/** all checkbox check **/
$(document).on('click','#checkAllBtn',function(){
    $('.parent_li').find('input').prop('checked',true);
    $('.parent_li').find('input.last-child:first').attr("readonly",true);
});

/** all checkbox uncheck **/
$(document).on('click','#unCheckAllBtn',function(){
    $('.parent_li:not(:first-child)').find('input').prop('checked',false);
    $('.parent_li').find('input.last-child:first').attr("readonly",false);
});

/** expand all tree view **/
$(document).on('click','#expandAllBtn',function(){
    $('span.expend-btn').attr('title', 'Collapse this branch').addClass('expended').removeClass('collapsed');
    $('#role-menu li.parent_li').find(' > ul > li').show('fast');
    $('#role-menu li.parent_li li > span.expend-btn').parent('li').find(' > ul > li').show('fast');
});

/** collapse all tree view **/
$(document).on('click','#collapseAllBtn',function(){
    $('span.expend-btn').removeClass('expended').addClass('collapsed').attr('title', 'Expand this branch');
    $('#role-menu li.parent_li').find(' > ul > li').hide('fast');
    $('#role-menu li.parent_li li > span.expend-btn').parent('li').find(' > ul > li').hide('fast');
});
