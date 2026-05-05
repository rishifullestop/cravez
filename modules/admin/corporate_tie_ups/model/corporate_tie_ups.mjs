import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, moveUploadedFile, getDatabaseSlug, getRandomString, generateMD5Hash, generateReferralCode } from "../../../../utils/index.mjs";
import { saveSystemLogs, sendMailToUsers} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import xlsx from 'xlsx';
import { each as asyncEach, parallel as asyncParallel } from "async";

const readFileXlsx = xlsx.readFile;

/**
 * CorporateTieUps model class for admin corporate tie ups management
 */
class CorporateTieUps {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.CORPORATE_TIE_UPS);
        this.usersCollection = db.collection(Tables.USERS);
    }

    /**
     * Get corporate tie ups list (datatable or render page)
     */
    async getCorporateList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const dataTableConfig = await configDatatable(req, res, null);

                const dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                { $project: {
                                    _id: 1, corporate_name: 1, minimum_order_amount: 1, free_delivery: 1, created: 1
                                }},
                            ],
                            count: [
                                { $count: "count" }
                            ]
                        }
                    }
                ]).toArray();

                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                req.breadcrumbs(BREADCRUMBS['admin/corporate_tie_ups/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get detail of corporate tie up
     */
    async getCorporateDetails(req, res, next) {
        try {
            let corporateId = req.params.id ? req.params.id : "";
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(corporateId)
            }, {
                projection: { _id: 1, corporate_name: 1, discounts: 1, free_delivery: 1, minimum_order_amount: 1,kfg_offer_id:1,kfg_offer_name:1 }
            });
            if (!result) {
                return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            }
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add or edit corporate tie up (validation handled in middleware)
     */
    async addEditCorporate(req, res, next) {
        try {
            let isEditable = req.params.id ? true : false;
            let corporateId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
            let authId = req.session.user && req.session.user._id ? req.session.user._id : "";
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let discount = req.body.discount || [];
                let freeDelivery = req.body.free_delivery ? true : false;
                let minOrderAmount = (freeDelivery && req.body.min_order_amount) ? req.body.min_order_amount : 0;
			    let kfgOfferId		=	(req.body.kfg_offer_id) ? 	req.body.kfg_offer_id : "";
			    let kfgOfferName	=	(req.body.kfg_offer_name) ? 	req.body.kfg_offer_name : "";

                let errors = [];
                if(discount.length > 0){
                    discount.map((data)=>{
                        if(!errors) errors = [];
                        let index =  data.index;
                        if(data.min_order_amount || data.max_order_amount || data.discount_type || data.discount_value){
                            if(!data.min_order_amount){
                                let param = "min_order_amount_"+index;
                                errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_min_order_amount")});
                            }else{
                                if(data.min_order_amount && (isNaN(data.min_order_amount))){
                                    errors.push({ 'param': 'min_order_amount_'+index, 'msg': res.__("admin.corporate_tie_ups.please_enter_valid_min_order_amount") });
                                }
                            }
                            if(!data.max_order_amount){
                                let param = "max_order_amount_"+index;
                                errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_max_order_amount")});
                            }else{
                                if(data.max_order_amount && (isNaN(data.max_order_amount) || data.max_order_amount <=0)){
                                    errors.push({ 'param': 'max_order_amount_'+index, 'msg': res.__("admin.corporate_tie_ups.please_enter_valid_max_order_amount") });
                                }
                            }
                            if(!data.discount_type){
                                let param = "discount_type_"+index;
                                errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_select_discount_type")});
                            }
                            if(!data.discount_value){
                                let param = "discount_value_"+index;
                                errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_discount_value")});
                            }else{
                                if(data.discount_value &&  (isNaN(data.discount_value) || data.discount_value <= 0)){
                                    errors.push({'param':'discount_value_'+index,'msg':res.__("admin.corporate_tie_ups.please_enter_valid_discount_value")});
                                }else if(data.discount_type == Constants.DISCOUNT_BY_PERCENTAGE && data.discount_value > Constants.MAX_PERCENTAGE){
                                    errors.push({'param':'discount_value_'+index,'msg':res.__("admin.corporate_tie_ups.please_enter_valid_discount_value")});
                                }
                            }
                            if(data.min_order_amount && data.max_order_amount && parseFloat(data.max_order_amount) < parseFloat(data.min_order_amount)){
                                let param = "min_order_amount_"+index;
                                errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.min_should_not_greater")});
                            }
                        }
                    });
                }

                /** Send error response **/
			    if(errors.length >0) return res.send({status: Constants.STATUS_ERROR, message: errors});

                let discountData = [];
                if (discount.length > 0) {
                    discount.forEach(data => {
                        if (data.min_order_amount || data.max_order_amount || data.discount_type || data.discount_value) {
                            discountData.push({
                                min_order_amount: parseFloat(data.min_order_amount),
                                max_order_amount: parseFloat(data.max_order_amount),
                                discount_type: data.discount_type,
                                discount_value: parseFloat(data.discount_value)
                            });
                        }
                    });
                }
                let dataToBeUpdated = {
                    $set: {
                        corporate_name: {
                            ar: req.body.corporate_name_in_arabic,
                            en: req.body.corporate_name_in_english
                        },
                        free_delivery: freeDelivery,
                        minimum_order_amount: parseFloat(minOrderAmount),
                        kfg_offer_id		: kfgOfferId,
                        kfg_offer_name		: kfgOfferName,
                        modified: getUtcDate(),
                    },
                    $setOnInsert: {
                        user_id: new ObjectId(authId),
                        created: getUtcDate(),
                    }
                };
                if (discountData.length > 0) dataToBeUpdated["$set"].discounts = discountData;
                await this.collectionDb.updateOne({ _id: corporateId }, dataToBeUpdated, { upsert: true });
                saveSystemLogs(req, res, {
                    user_id: authId,
                    parent_id: corporateId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CORPORATE_TIE_UPS,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
                let message = isEditable ? res.__("admin.corporate_tie_ups.corporate_tie_ups_updated") : res.__("admin.corporate_tie_ups.corporate_tie_ups_added");
                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "corporate_tie_ups",
                });
            } else {
                let response = {};
                if (isEditable) {
                    response = await this.getCorporateDetails(req, res, next);
                    if (response.status !== Constants.STATUS_SUCCESS) {
                        return res.status(400).send({
                            status: Constants.STATUS_ERROR,
                            message: response.message
                        });
                    }
                }
                res.render('add_edit', {
                    layout: false,
                    result: response.result,
                    is_editable: isEditable,
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete corporate tie up
     */
    async corporateDelete(req, res, next) {
        try {
            let corporateId = new ObjectId(req.params.id);
            let authId = req.session.user._id;
            const user = await this.usersCollection.findOne({ corporate_id: corporateId });
            if (!user) {
                await this.collectionDb.deleteOne({ _id: corporateId });
                await saveSystemLogs(req, res, {
                    user_id: authId,
                    parent_id: corporateId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CORPORATE_TIE_UPS,
                    activity_type: Constants.ACTIVITY_TYPE_DELETE,
                    additional_details: {}
                });
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.corporate_tie_ups.corporate_tie_ups_has_been_deleted_successfully"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "corporate_tie_ups");
            } else {
                req.flash(Constants.STATUS_ERROR, res.__("admin.corporate_tie_ups.you_are_not_allowed_to_delete_this_corporate_as_users_are_already_imported"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "corporate_tie_ups");
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Import user data (file upload and parsing handled in controller)
     */
    async importUser(req, res, next) {
        try {
            let corporateId	=	(req.params.id) ? req.params.id : '';
            if(isPost(req)){
                if(!req.files || !req.files.file){
                    return res.send({ status: Constants.STATUS_ERROR, message	: [
                        {'param':'file','msg':res.__("admin.corporate_tie_ups.please_select_file")}
                    ]});
                }

                /** Upload  File **/
                let imageResponse = await moveUploadedFile(req,res,{
                    image				: req.files.file,
                    filePath			: Constants.IMPORT_USER_FILE_PATH,
                    allowedExtensions 	: Constants.ALLOWED_IMPORT_USER_EXTENSIONS,
                    allowedImageError 	: Constants.ALLOWED_IMPORT_USER_ERROR_MESSAGE,
                    allowedMimeTypes 	: Constants.ALLOWED_IMPORT_USER_MIME_EXTENSIONS,
                    allowedMimeError 	: Constants.ALLOWED_IMPORT_USER_MIME_ERROR_MESSAGE
                });

                /** Send error response **/
                if(imageResponse.status == Constants.STATUS_ERROR){
                    return res.send({status : Constants.STATUS_ERROR,message: [{'param':'file','msg':imageResponse.message}]});
                }

                /**Read file and set array  */
                let newFile 	= 	(imageResponse.fileName) ? imageResponse.fileName : "";

                try{
                    /** Read csv file */
                    let finalArray  	= [];
                    var data 			= [];
                    let dataRow			= [];
                    let count			= 0;
                    let headingColumn 	= Constants.CORPORATE_HEADING_COLUMN;

                    var workbook 		= readFileXlsx(Constants.IMPORT_USER_FILE_PATH+newFile);
                    var sheetNameList 	= workbook.SheetNames;

                    var firstSheetName = workbook.SheetNames[0];

                    /* Get worksheet */
                    var worksheet 		= workbook.Sheets[firstSheetName];
                    let totalRowsData 	= worksheet['!ref'].split(":");
                    let totalRows 		= totalRowsData[1].replace(/[^0-9]+/g, "");
                    if(totalRows == ""){
                        totalRows = 0;
                    }else{
                        totalRows=parseInt(totalRows);
                    }

                    if(worksheet && worksheet instanceof Object && Object.keys(worksheet).length>0){
                        let totalColumns 	= headingColumn;
                        let totalRows 		= 0;
                        /* Remove Extra columns from object */
                        if(worksheet['!margins']){
                            delete worksheet['!margins'];
                        }
                        if(worksheet['!ref']){
                            /* Calculate total rows */
                            let totalRowsData 	= worksheet['!ref'].split(":");
                            totalRows			= (totalRowsData[1]) ? totalRowsData[1] : 0;
                            totalRows			= totalRows.replace(/[^0-9]+/g, "");
                            if(totalRows == ""){
                                totalRows = 0;
                            }else{
                                totalRows=parseInt(totalRows);
                            }
                            delete worksheet['!ref'];
                        }

                        /* Column Names */
                        /* This array is valid for less then 26 columns */
                        let columnSeries= [
                            "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
                        ];

                        let fieldsArray	=	['first_name','last_name','email','mobile_number','date_of_birth','gender'];

                        /* Arrange array according to requirement */
                        for(let i=1;i<=totalRows;i++){
                            let fieldsData	=	{};
                            for(let j=0;j<totalColumns;j++){

                                let cellValue = (columnSeries[j] && worksheet[columnSeries[j]+i] && worksheet[columnSeries[j]+i].v) ? worksheet[columnSeries[j]+i]["v"] : "";
                                if(cellValue && cellValue.constructor == String){
                                    cellValue = cellValue.replace(/[`]/g,"");
                                }
                                fieldsData[fieldsArray[j]]	=	cellValue;
                            }
                            fieldsData['index']	=	i-1;
                            finalArray.push(fieldsData);
                        }
                    }
                    finalArray.shift();

                    /**Send response */
                    res.send({status : Constants.STATUS_SUCCESS,result :finalArray});
                }catch(e){
                    console.error('Error in file parsing in import user');
                    console.error(e);
                    res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("system.something_going_wrong_please_try_again")
                    })
                }
            }else{
                /** Render import page  **/
                req.breadcrumbs(BREADCRUMBS['admin/corporate_tie_ups/import_user']);
                res.render('import_user',{
                    corporate_id:corporateId

                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add user to corporate tie up (validation handled in middleware)
     */
    async addUser(req, res, next) {
        try {
            let authId 			= (req.session.user && req.session.user._id) ? req.session.user._id :"";
            let corporateId = req.params.id ? req.params.id : '';
            if (isPost(req)) {
                req.body			= sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let userData		= (req.body.users) 	? req.body.users 		: [];

                if(userData.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

                /**Check errors and if no error set array to save data */
                let errors			= [];
                let dataToBeSaved	= [];
                let uniqueNames 	= {email : {},mobile:{}};
                asyncEach(userData, (user, callback) => {
                    if(!user.first_name || user.first_name == ""){
                        let param = "first_name_"+user.index;
                        errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_first_name")});
                    }
                    if(!user.last_name || user.last_name == ""){
                        let param = "last_name_"+user.index;
                        errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_last_name")});
                    }
                    if(!user.email || user.email == ""){
                        let param = "email_"+user.index;
                        errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_email")});
                    }else{
                        let param = "email_"+user.index;
                        if(!Constants.EMAIL_REGULAR_EXPRESSION.test(String(user.email).toLowerCase())) errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_valid_email_address")});
                    }
                    if(!user.mobile_number || user.mobile_number == ""){
                        let param = "mobile_number_"+user.index;
                        errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_mobile_number")});
                    }else{
                        let param = "mobile_number_"+user.index;
                        if(!Constants.MOBILE_REGULAR_EXPRESSION.test(String(user.mobile_number))) errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_valid_mobile_number")});
                    }
                    if(!user.date_of_birth || user.date_of_birth == ""){
                        let param = "date_of_birth_"+user.index;
                        errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_date_of_birth")});
                    }
                    if(!user.gender || user.gender == ""){
                        let param = "gender_"+user.index;
                        errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.please_enter_gender")});
                    }

                    /** check duplicate entry in form*/
                    if(user.email){
                        let tempName   = user.email.trim().toLowerCase();
                        let param = "email_"+user.index;
                        if(uniqueNames.email[tempName]){
                            errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.whoops_you_have_entered_an_already_used_email")});
                        }else{
                            uniqueNames.email[tempName] = true;
                        }
                    }

                    if(user.mobile_number){
                        let tempName   = user.mobile_number.trim();
                        let param = "mobile_number_"+user.index;
                        if(uniqueNames.mobile[tempName]){
                            errors.push({'param':param,'msg':res.__("admin.corporate_tie_ups.whoops_you_have_entered_an_already_used_mobile_number")});
                        }else{
                            uniqueNames.mobile[tempName] = true;
                        }
                    }

                    let fullName	=	user.first_name+' '+user.last_name;

                    if(errors.length) return callback(null);

                    asyncParallel({
                        already_exists: (subCallback)=>{
                            this.usersCollection.findOne(
                                {
                                  $or: [
                                    { email: { $regex: "^" + user.email + "$", $options: "i" } },
                                    { mobile_number: user.mobile_number }
                                  ],
								    is_deleted	: Constants.NOT_DELETED,
                                },
                                {
                                  projection: {
                                    _id: 1,
                                    email: 1,
                                    mobile_number: 1
                                  }
                                }
                            ).then(result => {
                                if(result){
                                    let errMessage	 = [];
                                    let resultMail 	 = result.email.toLowerCase();
                                    let resultMobile = result.mobile_number;
                                    let enteredMail  = user.email.toLowerCase();
                                    let mobileNumber = user.mobile_number;

                                    /** Push error message in array if email or mobile already exists*/
                                    if(resultMail == enteredMail){
                                        errMessage.push({'param':'email','msg':res.__("admin.user_management.email_id_is_already_exist")});
                                    }
                                    if(resultMobile == mobileNumber){
                                        errMessage.push({'param':'mobile_number','msg':res.__("admin.user_management.mobile_number_is_already_exist")});
                                    }

                                    /** Send error response **/
                                    return subCallback(null,{status : Constants.STATUS_ERROR, message : errMessage});
                                }
                                subCallback(null,{status: Constants.STATUS_SUCCESS});
                            }).catch(subCallback)
                        },
                        slug : (subCallback)=>{
                            /** Get slug **/
                            getDatabaseSlug({
                                title 		:	fullName,
                                table_name 	: 	Tables.USERS,
                                slug_field 	: 	"slug"
                            }).then(slugResponse=>{
                                let slug = (slugResponse && slugResponse.title) ? slugResponse.title :"";
                                subCallback(null,slug);
                            }).catch(next);
                        },
                        new_password : (subCallback)=>{
                            getRandomString(req,res,{srting_length:Constants.PASSWORD_MIN_LENGTH}).then(password=>{
                                if(password.status != Constants.STATUS_SUCCESS) return subCallback(password.message);
                                let originalPassword	=	password.result;

                                /**Genrate password hash */
                                let newPassword = generateMD5Hash(originalPassword);
                                let passwordObject	=	{
                                    org_password:	originalPassword,
                                    enc_password:	newPassword,
                                };
                                subCallback(null,passwordObject);

                            });
                        },
                        referral_code : (subCallback)=>{
                            generateReferralCode(req,res,{ prefix : fullName}).then(referralResponse=>{
                                if(referralResponse.status != Constants.STATUS_SUCCESS) return callback(referralResponse);
								subCallback(null,referralResponse.referral_code);
                            });
                        },
                    },(parallelErr,response)=> {
                        if(parallelErr) return callback(parallelErr);

                        let exists 	 = (response.already_exists)  	? response.already_exists 	:"";

                        let slug	 = (response.slug)				? response.slug:"";
						let referralCode= (response.referral_code)	?	response.referral_code	:"";
                        let password = (response.new_password && response.new_password.enc_password)	? response.new_password.enc_password:"";

                        if(exists.status != Constants.STATUS_SUCCESS){
                            if(!exists.valid_user) errors.push({'param': exists.message[0].param+"_"+user.index,'msg':exists.message[0].msg});
                        }

                        /** Push data in array */
                        if(errors.length == 0){
                            let userId	 =	new ObjectId();
                            let tempData = {
                                _id					: userId,
                                first_name			: user.first_name,
                                last_name			: user.last_name,
                                email				: user.email,
                                mobile_number		: user.mobile_number,
                                date_of_birth		: user.date_of_birth,
                                gender				: user.gender,
                                corporate_id		: corporateId,
                                password			: password,
                                slug				: slug,
                                date_of_birth		: getUtcDate(user.date_of_birth+" "+Constants.START_DATE_TIME_FORMAT),
                                user_role_id		: Constants.CUSTOMER,
                                phone_country_code 	: Constants.DEFAULT_COUNTRY_CODE,
                                user_type			: Constants.USER_TYPE_OTHER,
                                corporate_id		: new ObjectId(corporateId),
                                full_name			: fullName,
                                active 				: Constants.ACTIVE,
                                is_verified 		: Constants.VERIFIED,
                                is_email_verified	: Constants.VERIFIED,
                                is_mobile_verified	: Constants.VERIFIED,
                                is_deleted 			: Constants.NOT_DELETED,
                                created_by			: new ObjectId(authId),
                                created 			: getUtcDate(),
                                modified   			: getUtcDate(),
								referral_details		: {
									referral_code 		: referralCode,
									referrer_user_code 	: "",
									referred_by 		: "",
								},
                            };
                            dataToBeSaved.push(tempData);

                            /*************** Send mail  ***************/
                            sendMailToUsers(req,res,{
                                event_type 			:	Constants.CORPORATE_REGISTRATION_EVENT,
                                customer_fullname	: 	fullName,
                                customer_email		: 	user.email,
                                customer_mobile		: 	user.mobile_number,
                                customer_password	: 	(response.new_password.org_password) ? response.new_password.org_password:"",
                            });
                            /*************** Send mail  ***************/

                            /** save System logs */
                            saveSystemLogs(req, res, {
                                user_id				: authId,
                                parent_id			: userId,
                                activity_module		: Constants.SYSTEM_LOG_MODULE_CORPORATE_TIE_UPS,
                                activity_type		: Constants.ACTIVITY_TYPE_IMPORT_USER,
                                additional_details	: {corporate_id: corporateId}
                            }).then(()=>{ });
                        }
                        callback(null);
                    });
                },async (asyncErr)=>{
                    if(asyncErr) return next(asyncErr);

                    /** Send error response **/
                    if(errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors});

                    if(dataToBeSaved.length < 1) return res.send({
                        status : Constants.STATUS_ERROR,
                        message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]
                    });

                    try{
                        /**Save data */
                        await this.usersCollection.insertMany(dataToBeSaved,{forceServerObjectId:true});

                        req.flash(Constants.STATUS_SUCCESS,res.__("admin.corporate_tie_ups.import_successfull"));
                        res.send({
                            status 		:Constants.STATUS_SUCCESS,
                            redirect_url:Constants.WEBSITE_ADMIN_URL+"corporate_tie_ups/import_user/"+corporateId,
                        });
                    }catch(e){return next(e)};

                });
            }else{
                res.render('add_user', {
                    layout: false,
                    corporate_id: corporateId
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

export default CorporateTieUps;
