import { body } from 'express-validator';
import {cleanRegex} from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';

const addEditValidation = [
    body('name_english')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.cities.please_enter_city_name_in_english"))
        .custom(async (value, { req }) => {
            const db = getDb();
            const cityId = req.params.id ? new ObjectId(req.params.id) : null;
            const existing = await db.collection(Tables.CITIES).findOne({
                _id: { $ne: cityId },
                "name.en": { $regex: '^' + cleanRegex(value) + '$', $options: 'i' }
            }, { projection: { _id: 1 } });
            if (existing) {
                return Promise.reject(req.__("admin.cities.whoops_you_have_entered_an_already_used_name_in_english_please_try_something_different"));
            }
            return true;
        }),
    body('name_arabic')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.cities.please_enter_city_name_in_arabic"))
        .custom(async (value, { req }) => {
            const db = getDb();
            const cityId = req.params.id ? new ObjectId(req.params.id) : null;
            const existing = await db.collection(Tables.CITIES).findOne({
                _id: { $ne: cityId },
                "name.ar": { $regex: '^' + cleanRegex(value) + '$', $options: 'i' }
            }, { projection: { _id: 1 } });
            if (existing) {
                return Promise.reject(req.__("admin.cities.whoops_you_have_entered_an_already_used_name_in_arabic_please_try_something_different"));
            }
            return true;
        })
];

export {
    addEditValidation
};