/**  including .env file */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const mongoUrl = process.env.MONGO_URL;
const dbName = process.env.DATABASE;
let _db;

export const connectToServer = async () => {
	try {
		console.log("Connecting to MongoDB...");
		// Ensure the connection string is properly formatted
		const connectionString = `${mongoUrl}${dbName}`.replace(/\b0+(\d+)/g, '$1');
		const client = await MongoClient.connect(connectionString);
		console.log("Connected to MongoDB successfully, db - ",mongoUrl, dbName);
		_db = client.db(dbName);
		return _db;
	} catch (err) {
		console.error('Failed to connect to MongoDB:', err);
		throw err;
	}
};

export const getDb = () => {
	return _db;
};
