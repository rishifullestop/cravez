import homeModel from "./model/home.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure home routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api';
    const homeModule   =  new homeModel(db);

    router.post(modulePath + "/cms", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getCmsDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/settings", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getSystemSettings(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/faqs", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getFaqList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/packages", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getAllPackages(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/favorite-items", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getFavoriteItemList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/favorite-items/delete", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.deleteFavoriteItem(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/favorite-items/add", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.addUserFavoriteItem(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/sliders", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getSliderImages(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/cities", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getCityList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/areas", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getAreaList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/blocks", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getBlockList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/cuisines", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getCuisinesList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/fetch-area-id", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getAreaId(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/masters", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getMasterList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/packages/purchase", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.purchasePackage(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/pending-packages", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getPendingPackageRequestList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/packages/accept-reject", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.acceptRejectPackage(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/validate-mobile", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.validateMobileNumber(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/contact-us", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.contactUs(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/get-area-id", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getAreaIdByLatLong(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/update-language", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.changeLanguage(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/featured-restaurants", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getFeaturedRestaurants(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/ads-slider-images", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getAdsSliderImages(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/banners", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await homeModule.getBanners(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}