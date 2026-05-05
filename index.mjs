/** Node express */
import express from 'express';
import expressSession from 'express-session';
import i18n from 'i18n';
// import helmet from 'helmet';
import compression from 'compression';
import breadcrumbs from 'express-breadcrumbs';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import ejsLayouts from 'express-ejs-layouts';
import fileUpload from 'express-fileupload';
import flash from 'express-flash';
import dotenv from 'dotenv';
import MongoStore from 'connect-mongo';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as mongo from './config/connection.mjs';
import * as renderHtml from './render.mjs';
import * as routes from './routes/web.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/** required for Helmet (Secure Web) */
// app.use(helmet());

/** required for Compression */
app.use(compression({
	level: 9,
	memLevel: 9
}));

/**  Configure i18n options, this module is used for multi language site */
i18n.configure({
	locales: ['en', 'ar'],
	defaultLocale: 'en',
	directory: path.join(__dirname, 'locales'),
	directoryPermissions: '755',
	autoReload: true,
	updateFiles: false
});
app.use(i18n.init);

/**  Set Breadcrumbs home information */
app.use(breadcrumbs.init());
app.use(breadcrumbs.setHome());

/** Mount the breadcrumbs at `/admin` */
app.use('/admin', breadcrumbs.setHome({
	name: 'Home',
	url: '/admin'
}));

/** bodyParser for node js */
app.use(bodyParser.urlencoded({
	extended: true,
	limit: '50mb',
	parameterLimit: 1000000
}));
app.use(bodyParser.json());

/**  read cookies (needed for auth) */
app.use(cookieParser());

/** Initialize Ejs Layout  */
app.use(ejsLayouts);
app.set('view engine', 'html');
app.engine('html', (await import('ejs')).renderFile);

/** Set publicly accessible folder */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/frontend', express.static(path.join(__dirname, 'public/frontend')));
app.use('/frontend/uploads', express.static(path.join(__dirname, 'public/frontend/uploads')));
app.use('/public/frontend/uploads', express.static(path.join(__dirname, 'public/frontend/uploads')));

/** Use to upload files */
app.use(fileUpload());

/**  This module is used for flash messages in the system */
app.use(flash());

/**  including .env file */
dotenv.config();

/**  including render file */
app.use(renderHtml.default);

const server = createServer(app);

const SOCKET_ENABLE = JSON.parse(process.env.SOCKET_ENABLE || 'false');
let io = SOCKET_ENABLE &&  new Server(server) || null;

server.listen(process.env.PORT, () => {
	server.timeout = parseInt(process.env.MAX_EXECUTION_TIME);
	console.log('Server listening on port ' + process.env.PORT+" Time- "+new Date());
	console.error('Server listening on port ' + process.env.PORT+" Time- "+new Date());
});

/** Function to get unhandled errors and prevent to stop nodejs server **/
process.on("uncaughtException", function (err) {
	console.log("error name ---------"+err.name);    // Print the error name
	console.log("error date ---------"+new Date());    // Print the error name
	console.log("error message ---------"+err.message); // Print the error message
	console.log("error stack ---------"+err.stack);   // Print the stack trace
	// setTimeout(function(){
	// 	process.exit(1);
	// },1000);
});

try {
	await mongo.connectToServer();
	console.log("MongoDB connection established");

	let sessionTimeInSeconds = 15 * 24 * 60 * 60;
	app.use(expressSession({
		secret: 'NodeJs9799530SecretKey515',
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({
			client: mongo.getDb().client,
			collectionName: 'sessions',                 // optional
			ttl: sessionTimeInSeconds, // 15 days,
			autoRemove: 'interval',
			autoRemoveInterval: 60 * 24, // In a day
		}),
		cookie: {
			maxAge: sessionTimeInSeconds * 1000
		}
	}));

	await routes.configure(app, io, mongo);

} catch (err) {
	console.error('Failed to connect to MongoDB:', err);
	// process.exit(1);
}
