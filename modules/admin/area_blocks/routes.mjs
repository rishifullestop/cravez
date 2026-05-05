import { fileURLToPath } from 'url';
import { dirname } from 'path';
import areaBlocks from "./model/area_blocks.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure area blocks routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath =   '/area_blocks' ;
    const areaBlocksModule = new areaBlocks(db);

    // Set views for all /area_blocks* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        areaBlocksModule.getAreaBlocksList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        areaBlocksModule.addEditAreaBlock(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        areaBlocksModule.addEditAreaBlock(req, res, next);
    });

    router.all(modulePath+"/status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        areaBlocksModule.updateAreaBlockStatus(req, res, next);
    });

    router.all(modulePath+"/area_list", checkLoggedInAdmin, (req, res, next) => {
        areaBlocksModule.blockAreaList(req, res, next);
    });
} 