import { fileURLToPath } from 'url';
import { dirname } from 'path';
import BranchOfferLink from "./model/branch_offer_link.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/branch_offer_link';
    const branchOfferLinkModule = new BranchOfferLink(db);

    // Set views for all /branch_offer_link* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        branchOfferLinkModule.getBranchOfferLinkList(req, res, next);
    });

    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        branchOfferLinkModule.addBranchOfferLink(req, res, next);
    });

    router.post(modulePath + "/restaurant_branch_list", checkLoggedInAdmin, (req, res, next) => {
        branchOfferLinkModule.restaurantBranchList(req, res, next);
    });
} 