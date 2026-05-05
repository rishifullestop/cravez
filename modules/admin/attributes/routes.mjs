import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Attributes from "./model/attributes.mjs";
import { addEditValidation, changeOrderValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/attributes';
    const attributesModule = new Attributes(db);

    // Set views for all /attributes* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        attributesModule.attributeList(req, res, next);
    });

    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        attributesModule.addEditAttribute(req, res, next);
    });

    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        attributesModule.addEditAttribute(req, res, next);
    });

    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        attributesModule.deleteAttribute(req, res, next);
    });

    router.all(modulePath + "/change_order", checkLoggedInAdmin, changeOrderValidation, validateRequest, (req, res, next) => {
        attributesModule.changeOrderValue(req, res, next);
    });
} 