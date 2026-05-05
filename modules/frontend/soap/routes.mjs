import https from 'https';
import soap from 'soap';
import fs from 'node:fs';

import soapModel from "./model/soap.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import * as Helpers from '../../../utils/index.mjs';

/**
 * Configure Soap routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(app, { db }) {
    const modulePath = 	Constants.FRONT_END_NAME + "kfg_api";
    const soapModule =	new soapModel(db);
	const soapUrl 	 =	Constants.KFG_SOAP_API_URL;

	// load the WSDL file
	const xml = fs.readFileSync(Constants.WEBSITE_ROOT_PATH + 'cert/myservice.wsdl', 'utf8');

	// the service
	const serviceObject = {
		AdHocChangesImplService: {
			AdHocChangesImplPort: {
				RefreshReasons: async (args)=>{
					let response = await soapRequest("RefreshReasons",args);
					return response;
				},
				RefreshProvinces: async (args)=>{
					let response = await soapRequest("RefreshProvinces",args);
					return response;
				},
				RefreshCities: async (args)=>{
					let response = await soapRequest("RefreshCities",args);
					return response;
				},
				RefreshDistricts: async (args)=>{
					let response = await soapRequest("RefreshDistricts",args);
					return response;
				},
				RefreshAreas: async (args)=>{
					let response = await soapRequest("RefreshAreas",args);
					return response;
				},
				RefreshCountries: async (args)=>{
					let response = await soapRequest("RefreshCountries",args);
					return response;
				},
				RefreshStreets: async (args)=>{
					let response = await soapRequest("RefreshStreets",args);
					return response;
				},
				AddVGroup: async (args)=>{
					let response = await soapRequest("AddVGroup",args);
					return response;
				},
				UpdateVGroup: async (args)=>{
					let response = await soapRequest("UpdateVGroup",args);
					return response;
				},
				DeleteVGroup: async (args)=>{
					let response = await soapRequest("DeleteVGroup",args);
					return response;
				},
				DeleteCategory: async (args)=>{
					let response = await soapRequest("DeleteCategory",args);
					return response;
				},
				DeleteItems: async (args)=>{
					let response = await soapRequest("DeleteItems",args);
					return response;
				},
				UpdateSubMenu: async (args)=>{
					let response = await soapRequest("UpdateSubMenu",args);
					return response;
				},
				InsertSubMenu: async (args)=>{
					let response = await soapRequest("InsertSubMenu",args);
					return response;
				},
				DeleteSubMenu: async (args)=>{
					let response = await soapRequest("DeleteSubMenu",args);
					return response;
				},
				UpdateItems: async (args)=>{
					let response = await soapRequest("UpdateItems",args);
					return response;
				},
				DeleteSelector: async (args)=>{
					let response = await soapRequest("DeleteSelector",args);
					return response;
				},
				DeleteDoughType: async (args)=>{
					let response = await soapRequest("DeleteDoughType",args);
					return response;
				},
				AddOrUpdateSize: async (args)=>{
					let response = await soapRequest("AddOrUpdateSize",args);
					return response;
				},
				DeleteSize: async (args)=>{
					let response = await soapRequest("DeleteSize",args);
					return response;
				},
				RefreshStoreData: async (args)=>{
					let response = await soapRequest("RefreshStoreData",args);
					return response;
				},
				UpdateStoreData: async (args)=>{
					let response = await soapRequest("UpdateStoreData",args);
					return response;
				},
				AddModifierGroup: async (args)=>{
					let response = await soapRequest("AddModifierGroup",args);
					return response;
				},
				AddItems: async (args)=>{
					let response = await soapRequest("AddItems",args);
					return response;
				},
				RefreshDistrictAreaMap: async (args)=>{
					let response = await soapRequest("RefreshDistrictAreaMap",args);
					return response;
				},
				RefreshFeedbackTypes: async (args)=>{
					let response = await soapRequest("RefreshFeedbackTypes",args);
					return response;
				},
				AddOrUpdateDoughType: async (args)=>{
					let response = await soapRequest("AddOrUpdateDoughType",args);
					return response;
				},
				RefreshStoreAreaMap: async (args)=>{
					let response = await soapRequest("RefreshStoreAreaMap",args);
					return response;
				},
				RefreshNationalities: async (args)=>{
					let response = await soapRequest("RefreshNationalities",args);
					return response;
				},
				UpdateStoreAreaMap: async (args)=>{
					let response = await soapRequest("UpdateStoreAreaMap",args);
					return response;
				},
				RefreshPaymentTypes: async (args)=>{
					let response = await soapRequest("RefreshPaymentTypes",args);
					return response;
				},
				DeleteModifierGroup: async (args)=>{
					let response = await soapRequest("DeleteModifierGroup",args);
					return response;
				},
				ItemAndModifierGroupMap: async (args)=>{
					let response = await soapRequest("ItemAndModifierGroupMap",args);
					return response;
				},
				RefreshPhoneTypes: async (args)=>{
					let response = await soapRequest("RefreshPhoneTypes",args);
					return response;
				},
				RefreshOrderTypes: async (args)=>{
					let response = await soapRequest("RefreshOrderTypes",args);
					return response;
				},
				RefreshOrderStatusTypes: async (args)=>{
					let response = await soapRequest("RefreshOrderStatusTypes",args);
					return response;
				},
				AddOrUpdateCategory: async (args)=>{
					let response = await soapRequest("AddOrUpdateCategory",args);
					return response;
				},
				RefreshCustomerGenders: async (args)=>{
					let response = await soapRequest("RefreshCustomerGenders",args);
					return response;
				},
				RefreshFeedbackSubTypes: async (args)=>{
					let response = await soapRequest("RefreshFeedbackSubTypes",args);
					return response;
				},
				RefreshCustomerTypes: async (args)=>{
					let response = await soapRequest("RefreshCustomerTypes",args);
					return response;
				},
				RefreshOrderModes: async (args)=>{
					let response = await soapRequest("RefreshOrderModes",args);
					return response;
				},
				AddOrUpdateSelector: async (args)=>{
					let response = await soapRequest("AddOrUpdateSelector",args);
					return response;
				},
				RefreshCustomerTitles: async (args)=>{
					let response = await soapRequest("RefreshCustomerTitles",args);
					return response;
				},
				RefreshAddressTypes: async (args)=>{
					let response = await soapRequest("RefreshAddressTypes",args);
					return response;
				},
				UpdateModifierGroup: async (args)=>{
					let response = await soapRequest("UpdateModifierGroup",args);
					return response;
				},
				RefreshDiscountTypes: async (args)=>{
					let response = await soapRequest("RefreshDiscountTypes",args);
					return response;
				},
			}
		}
	};

	/** start listening soap server*/
	soap.listen(server, modulePath, serviceObject, xml,(err)=>{
		if(err){
			console.log("Error on create soap server",err);
		}else{
			console.log("Soap server listen")
		}
	});

	/** Routing used to test place order on kfg */
	app.get(Constants.FRONT_END_NAME+'place_order/:order_id/:is_modified?',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.kfgPlaceOrder(req,res,next,client).then(response=>{
				return res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to test cancel order on kfg and this url is only for testing*/
	app.get(Constants.FRONT_END_NAME+'cancel_order/:order_id', (req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.cancelOrder(req,res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get vgroups data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_vgroups/:menu_id?',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getVgroups(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get get combo by id from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_combo_details',(req, res,next) =>{
		soapModule.getComboItemDetails(req, res,next).then(response=>{
			res.send(response);
		}).catch(next);
	});

	/** Routing used to get get combo by id from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_combo_by_id/:combo_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getComboById(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get modifier groups data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_modiifer_groups/:menu_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getModifiersGroup(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get dough types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_dough_types/:menu_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getDoughTypeList(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get size list data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_size_list/:menu_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getSizeList(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get selectors list data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_selectors/:menu_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getSelectors(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get submenu categories data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_submenu_category/:menu_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getSubMenuCategory(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get customers data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_customer_data/:type/:value',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCustomerData(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get store data from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_store_data/:concept_id/:store_id?',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getStoreData(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get combo upsells from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_combo_upsells/:concept_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getComboUpsells(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get customer titles from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_customer_titles',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCustomerTitles(req, res,next).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get customer classess from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_customer_classes',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCustomerClasses(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get customer genders from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_customer_genders',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCustomerGenders(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get customer nationalities from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_customer_nationalities',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCustomerNationality(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get customer phone types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_customer_phone_types',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCustomerPhoneTypes(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get countries from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_countries',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getCountries(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get provinces from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_provinces/:country_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getProvinces(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get districts from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_districts/:city_id/:area_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getDistricts(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get streets from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_streets/:city_id/:area_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getStreets(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get reasons from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_reasons',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getReasons(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get feedback types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_feedback_types',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getFeedbackTypes(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get feedback sub types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_feedback_sub_types/:feedback_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getFeedbackSubTypes(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get payment types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_payment_types',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getPaymentTypes(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get discount types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_discount_types',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getDiscountTypes(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get order types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_order_types',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getOrderTypes(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get order statuses from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_order_statuses',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getOrderStatusTypes(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get items list*/
	app.get(Constants.FRONT_END_NAME+'get_item_list/:menu_id/:category_id?',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getItemsList(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get items mapping*/
	app.get(Constants.FRONT_END_NAME+'get_modifier_item_mapping/:item_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getModifierItemMaping(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get all modifier item from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_all_modifier_item',(req, res,next) =>{
		soapModule.getAllModifierItem(req, res,next).then(response=>{
			res.send(response);
		}).catch(next);
	});

	/** Routing used to get cities*/
	app.get(Constants.FRONT_END_NAME+'get_cities/:province_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.GetCities(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get areas*/
	app.get(Constants.FRONT_END_NAME+'get_areas/:city_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getAreas(req, res,next,client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get order modes from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_order_modes',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getOrderModes(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get address types from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_address_types',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getAddressTypes(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get order details from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_order_details/:order_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getOrderDetails(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get store area map from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_store_area_map/:concept_id',(req, res,next) =>{
		soap.createClient(soapUrl, (err, client)=>{
			soapModule.getStoreAreaMap(req, res,next, client).then(response=>{
				res.send(response);
			}).catch(next);
		});
	});

	/** Routing used to get all cities from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_all_cities_from_provinces',(req, res,next) =>{
		soapModule.getAllCities(req, res,next).then(response=>{
			res.send(response);
		}).catch(next);
	});

	/** Routing used to get all area from decima api*/
	app.get(Constants.FRONT_END_NAME+'get_all_area_from_cities',(req, res,next) =>{
		soapModule.getAllAreas(req, res,next).then(response=>{
			res.send(response);
		}).catch(next);
	});

	/** Routing used to get all modifier item from decima api*/
	app.all(Constants.FRONT_END_NAME+'save_kfg_hd_service_logs',(req, res,next) =>{
		soapModule.saveKfgHdServiceLogs(req, res,next).then(response=>{
			res.send(response);
		}).catch(next);
	});

	/** Routing used to get all modifier item from decima api*/
	app.get(Constants.FRONT_END_NAME+'update_kfg_branch_calender/:branch_id',(req, res,next) =>{
		soapModule.updateBranchCalender(req, res,next).then(response=>{
			res.send(response);
		}).catch(next);
	});

	/** this is a testing route to get data from decima*/
	app.get(Constants.FRONT_END_NAME+'get_data_from_kfg', (req, res,next) =>{
		try {
			const SOAP_LICENCE_KEY = Constants.KFG_SOAP_LICENCE_KEY;

			console.log("\n\n\n\nKFG APi - GetProvinces, CountryId - 3 ");
			console.log("Requested Time - "+Helpers.getUtcDate());
			console.log("Soap Url - "+soapUrl);
			console.log("Soap Licence Key - "+SOAP_LICENCE_KEY);

			https.get('https://api.ipify.org?format=json', function(resf){
				resf.setEncoding('utf8');
				resf.on('data', function(chunk){
					console.log("Server Ip - "+chunk);

					soap.createClient(soapUrl, (err, client)=>{

						if(err){
							console.log(err);
							return res.send({ soap : true, server_ip: chunk, err: String(err) });
						}
						try {
							client["GetProvinces"]({LicenceKey: SOAP_LICENCE_KEY, CountryId: 3},(err, response)=>{
								if(err){
									console.log("Status", "Client Not connected");

									return res.send({ client: true, server_ip: chunk, err: String(err)  });
								}else{
									console.log("response", response);
								}
								res.send({ err: err,  response : response});
							});
						}catch(e){
							res.send({ err: String(e), in_catch : true  });
						}
					});
				});
			});
		}catch(e){
			res.send({ err: String(e), first_catch : true });
		}
	});
}