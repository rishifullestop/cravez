import { body } from 'express-validator';
import {cleanRegex} from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
const ATTRIBUTES_REGEX = /^[1-9][0-9]*$/;

const addEditValidation = [
    body('title')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attribute_management.please_enter_title"))
        .custom(async (value, { req }) => {
            const db = getDb();
            const attributeType = req.params.type;
            const attributeId = req.params.id ? new ObjectId(req.params.id) : null;
            const existing = await db.collection(Tables.ATTRIBUTES).findOne({
                _id: { $ne: attributeId },
                type: attributeType,
                title: { $regex: '^' + cleanRegex(value) + '$', $options: 'i' }
            }, { projection: { _id: 1 } });
            if (existing) {
                return Promise.reject(req.__("admin.attribute_management.attribute_title_is_already_exist"));
            }
            return true;
        }),
    body('order')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attribute_management.please_enter_order"))
        .isNumeric()
        .withMessage((value, { req }) => req.__("admin.attribute_management.order_must_be_a_numeric_value"))
        .matches(ATTRIBUTES_REGEX)
        .withMessage((value, { req }) => req.__("admin.attribute_management.order_must_be_greater_then_zero")),
];

const changeOrderValidation = [
    body('new_order')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attribute_management.please_enter_order"))
        .isNumeric()
        .withMessage((value, { req }) => req.__("admin.attribute_management.order_must_be_a_numeric_value"))
        .matches(ATTRIBUTES_REGEX)
        .withMessage((value, { req }) => req.__("admin.attribute_management.order_must_be_greater_then_zero")),
];

export {
    addEditValidation,
    changeOrderValidation
};