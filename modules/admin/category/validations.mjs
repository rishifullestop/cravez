import { body } from 'express-validator';
import {cleanRegex} from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

const addEditValidation = [
    body('category_name')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.category.please_enter_category"))
        .custom(async (value, { req }) => {
            const db = getDb();
            const parentCategoryId = req.params.parent_category_id && ObjectId.isValid(req.params.parent_category_id) ? new ObjectId(req.params.parent_category_id) : 0;
            let conditions = {
                parent_category_id: parentCategoryId,
                category_name: { $regex: '^' + cleanRegex(value) + '$', $options: 'i' }
            };
            // if (req.params.id)  conditions._id = { $ne: new ObjectId(req.params.id) };
            if (req.body.category_type) conditions.category_type = req.body.category_type;

            const existing = await db.collection(Tables.CATEGORIES).findOne(conditions, { projection: { _id: 1 } });

            if (existing) {
                return Promise.reject(req.__("admin.category.whoops_you_have_entered_an_already_used"));
            }
            return true;
        }),
    body('category_type')
        .if((value, { req }) => req.params.parent_category_id == 0 && Constants.CATEGORY_SELECT_BOX)
        .notEmpty()
        .withMessage((value, { req }) =>{req.__("admin.category.please_select_category_type")}),
    body('order')
        .if((value, { req }) => Constants.CATEGORY_ADD_ORDER)
        .isInt()
        .withMessage((value, { req }) => req.__("admin.category.please_enter_integer_order")),
];

export {
    addEditValidation
};