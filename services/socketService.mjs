import * as Constants from "../config/global_constant.mjs";

import { io } from "socket.io-client";

let socketEnable = process.env.SOCKET_ENABLE && JSON.parse(process.env.SOCKET_ENABLE);
let clientSideSocket = null;

if(socketEnable){
	clientSideSocket = io(Constants.WEBSITE_SOCKET_URL, {
                transports: ["websocket"],
		reconnectionAttempts: 5, // try to reconnect 5 times
		timeout: 5000, // 5 seconds timeout for initial connection
	});

	clientSideSocket.on("connect", () => {
		console.log("Socket Connected, Id: ", clientSideSocket.id);
	});

	// When connection fails initially
	clientSideSocket.on("connect_error", (error) => {
		console.error("❌ Connection failed:", error.message);
	});
}


/**
 * Function for socket request from any where
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param options	As options
 *
 * @return null
 */
export const socketRequest = (req,res,options={})=>{
	if(socketEnable && clientSideSocket){
		if(options?.room_id && options?.emit_function){
			clientSideSocket.emit('socketRequest', options);
		}else{
			return res.__("system.missing_parameters");
		}
	}
}//end socketRequest()
