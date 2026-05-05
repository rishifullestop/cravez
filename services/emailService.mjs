import { createTransport } from 'nodemailer';
import { renderFile } from 'ejs';
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';
import { getUtcDate, newDate } from '../utils/index.mjs';
import * as Constants from "../config/global_constant.mjs";

/**
 * Function to send Email
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param options	As Email Options
 * @param db		As Database
 *
 * @return array
 */
export const sendMail = async (req, res, options) => {
	try {
		const db = getDb();

		const {
			to = "",
			rep_array = "",
			action = "",
			attachments = "",
			subject = ""
		} = options || {};

		const {
			"Email.user_email": userEmail,
			"Email.host": emailHost,
			"Email.password": emailPassword,
			"Email.user_name": emailUserName,
			"Email.port": emailPort
		} = res.locals.settings;

		const mailParams = {
			host: emailHost,
			port: emailPort,
			secure: false, // true for 465, false for other ports
			tls: {
				rejectUnauthorized: false
			}
		};

		/** Pass auth if smtpauth true in env file */
		const smptAuth = JSON.parse(process.env.SMTP_AUTH);
		if (smptAuth) {
			mailParams.auth = {
				user: userEmail,
				pass: emailPassword
			};
			mailParams.tls = {
				rejectUnauthorized: true
			};
			mailParams.secure = (emailPort == 465);
		}

		const transporter = createTransport(mailParams);
		const email_templates = db.collection(Tables.EMAIL_TEMPLATES);
		const email_actions = db.collection(Tables.EMAIL_ACTIONS);
		const users = db.collection(Tables.USERS);

		/** Run all queries in parallel **/
		const [emailTemplateResult, actionData, userDetails] = await Promise.all([
			// Get Email template details
			email_templates.findOne({
				action: action,
				$or: [{
					from: { $lte: newDate() },
					to: { $gte: newDate() }
				},
				{
					is_default: true
				}]
			}, {
				projection: { _id: 1, name: 1, subject: 1, body: 1 },
				sort: { from: Constants.SORT_DESC }
			}),

			// Get Email action details
			email_actions.findOne({
				action: action
			}, {
				projection: { _id: 1, options: 1 }
			}),

			// Get User details based on email
			users.findOne(
				{
					email: { $regex: new RegExp('^' + to + '$', 'i') },
					is_deleted: Constants.NOT_DELETED
				},
				{
					projection: {
						preferred_language: 1,
						_id: 1
					}
				}
			)
		]);

		if (!emailTemplateResult) {
			console.error("action : " + action);
			throw new Error('Error in email template');
		}

		if (!actionData) {
			console.error("action : " + action);
			throw new Error('Error in email action');
		}

		const actionOptions = actionData.options.toString().split(",");

		// Determine language to use
		const preferredLanguage = Constants.LANGUAGE_CODES[userDetails?.preferred_language || Constants.DEFAULT_LANGUAGE_CODE];
		let body = emailTemplateResult.body[preferredLanguage] || emailTemplateResult.body[Constants.DEFAULT_LANGUAGE_CODE];
		const finalSubject = subject || emailTemplateResult.subject[preferredLanguage] || emailTemplateResult.subject[Constants.DEFAULT_LANGUAGE_CODE];

		actionOptions.forEach((value, key) => {
			body = body.replace(RegExp('{' + value + '}', 'g'), rep_array[key]);
		});

		/** get email layout **/
		const html = await new Promise((resolve, reject) => {
			renderFile(Constants.WEBSITE_LAYOUT_PATH + 'email.html',
				{
					settings: res.locals.settings,
					WEBSITE_IMG_URL: Constants.WEBSITE_IMG_URL,
					WEBSITE_URL: Constants.WEBSITE_URL
				},
				'',
				(err, html) => {
					if (err) reject(err);
					else resolve(html);
				}
			);
		});

		const finalHtml = html.replace(RegExp('{{MESSAGE_BODY}}', 'g'), body);
		const mailOptions = {
			from: emailUserName,
			to: to,
			subject: finalSubject,
			html: finalHtml,
		};

		/** Send attachment **/
		if (attachments) {
			mailOptions.attachments = {
				path: attachments
			};
		}

		let emailInfo = null;
		let emailError = null;

		try {
			/** Send email **/
			emailInfo = await transporter.sendMail(mailOptions);
		} catch (error) {
			emailError = {
				message: error.message,
				code: error.code,
				command: error.command,
				stack: error.stack,
				responseCode: error.responseCode,
				response: error.response
			};
			console.error('Email sending error:', emailError);
		}

		/** Always save email logs regardless of success or failure **/
		await db.collection(Tables.EMAIL_LOGS).insertOne({
			...mailOptions,
			is_sent: !emailError,
			error: emailError,
			created: getUtcDate(),
			user_id: userDetails?._id || null,
			language: preferredLanguage,
			action: action,
			template_id: emailTemplateResult._id,
			action_id: actionData._id,
			smtp_config: {
				host: emailHost,
				port: emailPort,
				secure: mailParams.secure,
				auth: smptAuth ? true : false
			}
		});

		return {
			status	: 	emailError && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS,
			info	: 	emailInfo,
			error	:	emailError || "",
		};

	} catch (error) {
		console.error("email error in sendMail function");
		console.error(error);
		return { status: Constants.STATUS_ERROR };
	}
};