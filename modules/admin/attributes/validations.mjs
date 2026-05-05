import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';

const ATTRIBUTES_REGEX = /^[1-9][0-9]*$/;

const addEditValidation = [
    body('attribute_id')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attributes.please_enter_attribute_id"))
        .isNumeric()
        .withMessage((value, { req }) => req.__("admin.attributes.attribute_id_must_be_a_numeric_value"))
        .matches(ATTRIBUTES_REGEX)
        .withMessage((value, { req }) => req.__("admin.attributes.attribute_id_must_be_greater_then_zero"))
        .custom(async (value, { req }) => {
            const db = getDb();
            const attributeId = req.params.id ? new ObjectId(req.params.id) : null;
            const existing = await db.collection(Tables.ATTRIBUTES).findOne({
                _id: { $ne: attributeId },
                attribute_id: parseInt(value)
            }, { projection: { _id: 1 } });
            if (existing) {
                return Promise.reject(req.__("admin.attributes.attribute_id_is_already_exist"));
            }
            return true;
        }),
    body('title')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attributes.please_enter_title")),
    body('type')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attributes.please_select_attribute_type")),
    body('order')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attributes.please_enter_order"))
        .isNumeric()
        .withMessage((value, { req }) => req.__("admin.attributes.order_must_be_a_numeric_value"))
        .matches(ATTRIBUTES_REGEX)
        .withMessage((value, { req }) => req.__("admin.attributes.order_must_be_greater_then_zero")),
];

const changeOrderValidation = [
    body('new_order')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.attributes.please_enter_order"))
        .isNumeric()
        .withMessage((value, { req }) => req.__("admin.attributes.order_must_be_a_numeric_value"))
        .matches(ATTRIBUTES_REGEX)
        .withMessage((value, { req }) => req.__("admin.attributes.order_must_be_greater_then_zero")),
];

export {
    addEditValidation,
    changeOrderValidation
};