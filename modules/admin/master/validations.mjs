import { ObjectId } from 'mongodb';
import { body} from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";
import {cleanRegex} from "../../../utils/index.mjs";
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';


// Validation rules for add master operations
const addEditValidation = [
	body(`master_descriptions.${Constants.DEFAULT_LANGUAGE_MONGO_ID}.name`)
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.master.please_enter_name');
		})
		.custom((value, {req, res, next, location, path}) => {
            if(value) {
                return validateUniqueName(value, req).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.master.entered_name_already_exists', { value, location, path }));
                    } else {
                        return true;
                    }
                }).catch(next);
            } else {
                return true;
            }
        }),
	body('image')
		.custom((value, { req }) => {
			const masterType = req.params.type;
			if (masterType === 'category' && !req.params.id) {
				if (!req.files || !req.files.image) {
					throw new Error(req.__('admin.master.please_select_image'));
				}
			}
			return true;
		})
];

/**
 * Validate if master name already exists
 * @param {String} value - Name value to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateUniqueName = async (value, req) => {
    const masterType = req.params.type;
    let parentId     = (req.body.parent_id) ? ObjectId(req.body.parent_id) : "";

    let conditions = {
        dropdown_type: masterType,
		name: {$regex: '^' + cleanRegex(value) + '$', $options: 'i'}
    };
    if(masterType == "faq_category") conditions["parent_id"] = parentId;
    if(req.params && req.params.id) conditions["_id"] = {$ne: new ObjectId(req.params.id)};

    // Find existing master with same name
    const dbInstance = getDb();
    const existingMaster = await dbInstance.collection(Tables.MASTERS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingMaster && existingMaster._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    }
};

export { 
	addEditValidation, 
}; 