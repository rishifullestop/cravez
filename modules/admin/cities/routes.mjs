import { fileURLToPath } from 'url';
import { dirname } from 'path';
import City from "./model/city.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/cities';
    const cityModule = new City(db);

    // Set views for all /city* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        cityModule.getCitiesList(req, res, next);
    });

    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        cityModule.addEditCity(req, res, next);
    });

    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        cityModule.addEditCity(req, res, next);
    });
} 