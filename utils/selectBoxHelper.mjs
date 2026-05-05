
import { getDb } from '../config/connection.mjs';
import * as Constants from "../config/global_constant.mjs";

/**
 * Function to get dropdown list with html
 *
 * @param {Object} req - Request Data
 * @param {Object} res - Response Data
 * @param {Function} next - Next middleware function
 * @param {Object} options - Options object containing collections configuration
 * @returns {Promise<Object>} Promise resolving to dropdown list data
 */
export const getDropdownList = async (req, res, next, options) => {
	const collections = options?.collections || {};
	const finalHtmlData = {};

	if (!collections || collections.length === 0) {
		return {
			status: Constants.STATUS_ERROR,
			message: res.__("admin.system.missing_parameters")
		};
	}
	try {
		const dbInstance = getDb();
		const promises = collections.map(async (collectionRecords, j) => {
			const {
				collection = "",
				selected = [],
				columns = [],
				sub_title_field: subTitle = "",
				conditions = {},
				sort_conditions = {}
			} = collectionRecords;

			const columnKey = columns[0] || "";
			const fields = columns[1] || "";
			const columnValue = Array.isArray(fields) ? fields.join(".") : fields;

			if (!columnKey || !columnValue || !conditions) {
				return {
					status: Constants.STATUS_ERROR,
					message: res.__("admin.system.missing_parameters")
				};
			}

			const sortConditions = {
				[columnValue]: Constants.SORT_ASC,
				...sort_conditions
			};

			const finalColumns = {
				[columnKey]: 1,
				[columnValue]: 1,
				...(subTitle && { [subTitle]: 1 })
			};

			const collectionObject = dbInstance.collection(collection);
			const result = await collectionObject.aggregate([
				{ $match: conditions },
				{ $sort: sortConditions },
				{ $project: finalColumns }
			], { allowDiskUse: true }).toArray();

			let finalHtml = "";
			for (const record of result) {
				let optionTitle = record[columnValue];
				const optionSubTitle = subTitle ? record[subTitle] : "";
				const selectedHtml = selected.some(value => String(value) === String(record[columnKey])) 
					? 'selected="selected"' 
					: "";

				if (Array.isArray(fields) && fields.length > 0) {
					let temp = record;
					for (const key of fields) {
						temp = temp?.[key] || {};
					}
					optionTitle = typeof temp === 'string' ? temp : "";
				}

				const subTextString = optionSubTitle ? `data-subtext=" (${optionSubTitle})"` : "";
				finalHtml += `<option value="${record[columnKey]}" ${selectedHtml} ${subTextString}>${optionTitle}</option>`;
			}

			finalHtmlData[j] = finalHtml;
		});

		await Promise.all(promises);

		return {
			status: Constants.STATUS_SUCCESS,
			final_html_data: finalHtmlData
		};

	} catch (error) {
		console.error("Error in getDropdownList:", error);
		return {
			status: Constants.STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
};
