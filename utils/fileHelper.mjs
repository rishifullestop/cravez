import {constants as FS_CONSTANTS, mkdirSync, existsSync, copyFile} from 'fs';
import { stat, access, unlink } from 'fs/promises';
import needle from 'needle';
import path from 'path';
import { promisify } from 'util';

import * as Constants from "../config/global_constant.mjs";
import { newDate } from './dateHelper.mjs';
import { exec as execCb } from 'child_process';
const exec = promisify(execCb);

/**
 * Append file URL to each record in a list if the file exists on disk.
 *
 * @param {Object} options
 * @param {string} options.file_url - Base URL to prepend to image names
 * @param {string} options.file_path - Local path prefix for file checking
 * @param {Array}  options.result - Array of records to process
 * @param {string} options.database_field - Field name that holds image filename
 * @param {string} [options.image_placeholder=Constants.IMAGE_FIELD_NAME] - Field to append resolved image URL
 * @param {string} [options.no_image_available=Constants.NO_IMAGE_AVAILABLE] - Fallback image if file not found
 *
 * @returns {Promise<{result: Array, options: Object}>}
 */
export const appendFileExistData = async (options = {}) => {
	const {
		file_url = '',
		file_path = '',
		result = [],
		database_field = '',
		image_placeholder = Constants.IMAGE_FIELD_NAME,
		no_image_available = Constants.NO_IMAGE_AVAILABLE
	} = options;

	if (!Array.isArray(result) || result.length === 0) {
		return { result, options };
	}

	for (let i = 0; i < result.length; i++) {
		const record 		=	result[i];
		const imageName 	= 	record[database_field];
		const fullFilePath 	=	imageName ? file_path + imageName : '';

		result[i][image_placeholder] = no_image_available;

		try {
			const fileResponse = await checkFileExist({
				file: fullFilePath,
				file_url,
				image_name: imageName,
				record_index: i,
				no_image_available
			});

			const { record_index, file_url: resolvedUrl } = fileResponse;

			if (typeof record_index !== 'undefined' && resolvedUrl) {
				result[record_index][image_placeholder] = resolvedUrl;
			}
		} catch (error) {
			console.error(`Error checking file existence for index ${i}:`, error);
			// Continue loop even if one check fails
		}
	}

	return { result, options };
};

/**
 * Checks if a file exists and returns appropriate image URL.
 * @param {Object} options
 * @param {string} options.file - Full file system path to check
 * @param {string} options.file_url - Base URL for image access
 * @param {string} options.image_name - Filename
 * @param {number|string} options.record_index - Index in result array
 * @param {string} options.no_image_available - Fallback image path
 * @returns {Promise<Object>} Response with file_url and record_index
 */
export const checkFileExist = async (options = {}) => {
	const {
		file = '',
		file_url = '',
		image_name = '',
		record_index = '',
		no_image_available = Constants.NO_IMAGE_AVAILABLE
	} = options;

	let fileExists = false;

	try {
		await stat(file);
		fileExists = true;
	} catch (_) {
		fileExists = false;
	}

	return {
		file_url: fileExists ? `${file_url}${image_name}` : no_image_available,
		record_index,
		options
	};
};

/**
 * Check if an image file exists at the given path.
 * @param {string} imagePath - Absolute or relative path to the image.
 * @returns {Promise<boolean>} - True if image exists, false otherwise.
 */
export const imageExists = async (imagePath) => {
	if (!imagePath || typeof imagePath !== 'string') return false;

	try {
		await access(imagePath, FS_CONSTANTS.R_OK | FS_CONSTANTS.W_OK);
		return true;
	} catch {
		return false;
	}
};

/**
 * Removes a file from the root or given path.
 *
 * @param {Object} options
 * @param {string} options.file_path - Full absolute path of the file to remove
 * @returns {Promise<Object>} JSON response with status
 */
export const removeFile = async (options = {}) => {
	try {
		// Check if file path is provided
		if (!options?.file_path) {
			return { status: Constants.STATUS_ERROR };
		}

		// Attempt to remove the file using fs.promises.unlink
		unlink(options.file_path).then(() => {
			return { status: Constants.STATUS_SUCCESS };
		}).catch(()=>{
			return { status: Constants.STATUS_ERROR };
		});


	} catch (err) {
		return { status: Constants.STATUS_ERROR };
	}
};

// Wrap image.mv in a promise
function moveFile(image, destination) {
	return new Promise((resolve, reject) => {
		image.mv(destination, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

// Wrap needle.post in a promise
function postImage(url, data) {
	return new Promise((resolve, reject) => {
		needle.post(url, data, {
			multipart: true,
			strictSSL: false,
			rejectUnauthorized: false
		}, (err, res) => {
			if (err) reject(err);
			else resolve(res);
		});
	});
}

/**
 * Handles image upload, validation, optional remote sync, and cleanup.
 *
 * @param {Object} req - Express request object (for localization)
 * @param {Object} res - Express response object (for localization)
 * @param {Object} options - Upload configuration and file info
 * @returns {Promise<Object>} - Result JSON with status and filename
 */
export const moveUploadedFile = async (req,res,options={})=>{	
	let image 				=	options?.image	 || "";
	let ignoreUnlink		=	options?.ignore_unlink || false;
	let filePath 			=	options?.filePath || "";
	let oldPath 			=	options?.oldPath || "";
	let allowedExtensions 	=	options?.allowedExtensions	|| Constants.ALLOWED_IMAGE_EXTENSIONS;
	let allowedImageError 	=	options?.allowedImageError	|| Constants.ALLOWED_IMAGE_ERROR_MESSAGE;
	let allowedMimeTypes 	=	options?.allowedMimeTypes	|| Constants.ALLOWED_IMAGE_MIME_EXTENSIONS;
	let allowedMimeError 	=	options?.allowedMimeError	|| Constants.ALLOWED_IMAGE_MIME_ERROR_MESSAGE;
	let newFileName	 		=	options?.image_name || "";
	let target				=	filePath.replace(Constants.WEBSITE_UPLOADS_ROOT_PATH,"");

	/** Send success response **/
	if(!image) return {status : Constants.STATUS_SUCCESS, fileName: oldPath};

	let fileData	= (image.name)	? 	image.name.split('.') 			:[];
	let imageName	= (image.name)	? 	image.name 						:'';
	let extension	= (fileData)	?	fileData.pop().toLowerCase()	:'';

	/** Send error response **/
	if (allowedExtensions.indexOf(extension) == -1) return {status : Constants.STATUS_ERROR, message : allowedImageError};

	/** Create new folder of this month **/
	let newFolder	= 	"";
	if(newFileName){
		let tmpFolder 	= 	newFileName.split("/");
		newFolder 		=	tmpFolder.slice(0, tmpFolder.length - 1).join("/") + "/";
	}else{
		newFolder = (newDate("","MMM")+ newDate("","yyyy")).toUpperCase()+'/';
	}

	await createFolder(filePath+newFolder);

	if(!newFileName) newFileName = newFolder + Date.now()+ '-' +changeFileName(imageName);
	let uploadedFile	= filePath+newFileName;


	try{		
		/** move image to folder*/
		await moveFile(image, uploadedFile);

		const { stdout } = await exec(`file --mime-type -b ${uploadedFile}`);
		
		if(allowedMimeTypes.indexOf(stdout.trim()) == -1){
			removeFile({ file_path: uploadedFile });
			
			return {
				status: Constants.STATUS_ERROR,
				message: allowedMimeError
			};
		}	

		if(!Constants.UPLOAD_TO_SERVER) {
			if(!ignoreUnlink && oldPath){
				removeFile({file_path : filePath+oldPath}).then(()=>{});
			}

			/** Send success response **/
			return {status : Constants.STATUS_SUCCESS, fileName: newFileName};
		}

		// Upload to remote server
		await postImage(`${Constants.UPLOAD_SERVER_URL}upload_image`, {
			image: {
				file: uploadedFile,
				content_type: image.mimetype
			},
			image_name: newFileName,
			target: target
		});

		if (!ignoreUnlink && oldPath) {
			await removeFile({ file_path: filePath + oldPath });
			needle.post(`${Constants.UPLOAD_SERVER_URL}remove_image`, {
				image_name: oldPath,
				target: target
			}, () => {});
		}

		return {
			status: Constants.STATUS_SUCCESS,
			fileName: newFileName
		};
	}catch(e){
		console.log("Error at moveUploadedFile",e);
		return {
			status	: 	Constants.STATUS_ERROR,
			message	:	res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}

/**
 * Recursively creates folder structure if it doesn't exist.
 *
 * @param {string} targetPath - The full folder path to create
 * @returns {{ status: string }}
 */
export const createFolder = (targetPath) => {
	try {
		const normalizedPath	= 	path.normalize(targetPath);
		const pathSegments 		=	normalizedPath.split(path.sep);
		let fullPath = path.isAbsolute(normalizedPath) ? path.sep : '';

		for (const segment of pathSegments) {
			if (!segment) continue;
			fullPath = path.join(fullPath, segment);
			if (!existsSync(fullPath)) {
				mkdirSync(fullPath);
			}
		}

		return { status: Constants.STATUS_SUCCESS };

	} catch (error) {
		console.error('Error creating folder:', error);
		return { status: Constants.STATUS_ERROR };
	}
};

/**
 * Cleans a file name by removing special characters and preserving extension.
 *
 * @param {string} fileName - Original file name
 * @returns {string} - Sanitized file name
 */
export const changeFileName = (fileName = '') => {
	if (!fileName.includes('.')) return fileName;

	const parts = fileName.split('.');
	const extension = parts.pop();
	let baseName = parts.join('.');

	// Remove special characters and dots from base name
	baseName = baseName.replace(/[^0-9a-zA-Z]+/g, '');

	return `${baseName}.${extension}`;
};

/**
 * Function to copy file from one folder to another
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 * @param options	As Request Data Object contain file details
 *
 * @return json
 */
export const copyFileFromSource = (req,res,next,options={})=>{
	return new Promise(resolve=>{
		let sourceFolder		= (options.source_path)			? options.source_path 		:"";
		let sourceFileName		= (options.source_file_name)	? options.source_file_name	:"";
		let destinationFolder	= (options.destination_path)	? options.destination_path	:"";
		let sourcePath			= sourceFolder+sourceFileName;

		/** Create new folder of this month **/
		let newFolder	= 	(newDate("","MMM")+ newDate("","yyyy")).toUpperCase()+'/';
		createFolder(destinationFolder+newFolder);

		let newFileName		= newFolder + Date.now()+ '-' +changeFileName(sourceFileName);
		let uploadedFile	= destinationFolder+newFileName;

		/** copy file  */
		copyFile(sourcePath, uploadedFile, (err) => {
			if(err) return resolve({status: Constants.STATUS_ERROR, err:String(err), options: options});

			/** Send success response */
			resolve({
				status		: 	Constants.STATUS_SUCCESS,
				file_name 	:  	newFileName,
				options		:	options
			});
		});
	}).catch(next);
};//End copyFileFromSource()