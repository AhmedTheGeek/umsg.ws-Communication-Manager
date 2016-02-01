/**
 * @class Communication Manager Object, Responsible for connecting, sending, receiving from Server For Messages Applying umsg.ws structure.
 * @alias communicationManager
 * @author Ahmed Hussein (AhmedTheGeek)
 * @version 2.0
 */
 
var communicationManager =  {
	/** @lends communicationManager */
	
	/**
	 * @property {string} server - Socket Server URI
	 * @memberof communicationManager
	 */
    server: "",
	/**
	 * Connects to WS Server using HTML5 Websockets
	 * @function
	 * @memberof communicationManager
	 * @name connect
	 */
	connect: function(){
	    var websocket = new ReconnectingWebSocket(this.server);
		var _that = this;
		this.websocket = websocket;
		
		websocket.onmessage  = function(e){_that.onMessage(e);};
		websocket.onclose    = function(e){_that.onDisconnect(e);};
		websocket.onerror    = function(e){_that.onError(e);};
		websocket.onopen     = function(e){_that.onConnect(e);};

		setInterval(function () {
		    _that.checkLastUpdatedTime();
		}, 5000);

		return websocket;
	},
	/**
	 * @property {bool} connectionStatus - Represents connection status whether connected or not.
	 * @memberof communicationManager
	 */
	connectionStatus: false,
	/**
	 * @property {bool} isHandShaking - Indicates if the communication manager is performing a hand-shake.
	 * @memberof communicationManager
	 */
	isHandShaking : false,
	/**
	 * @property {int} lastReceivedMessage - Last received message timestamp 
	 * @memberof communicationManager
	 */
	lastReceivedMessage: null,
	/**
	 * On Connect event handler
	 * @function
	 * @name onConnect
	 * @memberof communicationManager
	 */
	onConnect: function(e) {
	    _that = this;
		this.connectionStatus = true;
		this.isHandShaking = true;

		this.updateLastRecievedMessage();

		eventManager.fireEvent("websocketConnected");
		eventManager.fireEvent("connected");

		this.processIncomingMessages();
		this.resendPendingMessage();
	},
	/**
	 * Performes a hand-shake
	 * @deperecated
	 * @memberof communicationManager
	 */
	handShake: function(){

	},
	/**
	 * Sends message to Server
	 * @function
	 * @name sendMessage
	 * @param {object} message - message to be sent, can be an object or string.
	 * @memberof communicationManager
	 */
	sendMessage: function (message, raw) {
		if(this.websocket !== null){
			if(this.connectionStatus){
				try{
				    this.websocket.send(JSON.stringify(message));
				}catch(_error){
				    this.pendingMessages.push(message);
				}
			} else {
			    this.pendingMessages.push(message);
			}
		}else{
			this.pendingMessages.push(message);
			logger.error("Please connect to server first!");
		}			
	},
	/**
	 * On Disconnect event handler
	 * @function
	 * @name onDisconnect
	 * @memberof communicationManager
	 */
	onDisconnect : function(e) {
		console.log("Closing Connection");
		eventManager.fireEvent("websocketDisconnected");

		this.connectionStatus = false;
	},
	/**
	 * On Error event handler
	 * @function
	 * @name onError
	 * @memberof communicationManager
	 */
	onError: function(e){
		eventManager.fireEvent("websocketError", e);
	},
	/**
	 * On Message event handler
	 * @function
	 * @name onMessage
	 * @memberof communicationManager
	 */
	onMessage: function(e){
	    this.incomingQueue.push(e);
	    this.updateLastRecievedMessage();
	},
	/**
	 * Updates last recieved message timestamp to now
	 * @function
	 * @name updateLastRecievedMessage
	 * @memberof communicationManager
	 */
	updateLastRecievedMessage: function () {
	    var time = Math.round((new Date().getTime()) / 1000);
	    this.lastReceivedMessage = time;
	},
	/**
	 * @property {array} pendingMessages - And object that holds messages that are pending connection status to become true, to get sent to Server.
	 * @memberof communicationManager
	 */
	pendingMessages: [],
	/**
	 * Resends all pending messages and clears the queue.
	 * @function
	 * @memberof communicationManager
	 */
	resendPendingMessage: function(){
		for(var message in this.pendingMessages){
		    this.sendMessage(this.pendingMessages[message]);
			this.pendingMessages.splice(message, 0);
		}
	},
	/**
	 * Checks last updated time and fires event with time update message to be reflected on the UI.
	 * @function
	 * @name checkLastUpdatedTime
	 * @memberof communicationManager
	 */
	checkLastUpdatedTime: function(){
	    var time = Math.round((new Date().getTime()) / 1000);
	    var updatedTime = time - this.lastReceivedMessage;

	    if (updatedTime == -1) {
	        updateMessage = "Never";
	    } else if (updatedTime < 5 && updatedTime > 0) {
	        updateMessage = "Just Now";
	    } else if (updatedTime > 10 && updatedTime <= 30) {
	        updateMessage = "Few Seconds Ago";
	    } else if (updatedTime >= 30 && updatedTime < 60) {
	        updateMessage = updatedTime + " Seconds Ago";
	    } else if (updatedTime >= 60) {
	        updateMessage = Math.round((updatedTime / 60)) + " Minutes Ago";
	    } else {
	        var updateMessage = "Just Now";
	    }

	    eventManager.fireEvent("lastUpdateTime", {
	        message: updateMessage
	    });
	},
	/**
	 * @property {object} websocket - The websocket object
	 * @memberof communicationManager
	 */
	websocket: null,
	/**
	 * @property {array} incomingQueue - Incoming messges queue, pending to be published.
	 * @memberof communicationManager
	 */
	incomingQueue: [],
	/**
	 * Pops and publishes message from the incomingQueue every 5ms
	 * @function
	 * @name processIncomingMessages
	 * @memberof communicationManager
	 */
	processIncomingMessages: function () {
	    if (communicationManager.incomingQueue.length > 0) {
	        eventManager.fireEvent("websocketMessage", communicationManager.incomingQueue.pop());
	    }

	    setTimeout(communicationManager.processIncomingMessages, 5);
	},
   /**
	* Processes hooked messages and executes their hooked functions/methods.
	* @function
	* @name processHookedMessages
	* @param {string} messageType - response message type.
	* @param {object} messageResponse - response object.
	* @memberof communicationManager
	*/
	processHookedMessages: function (messageType, messageResponse) {
	    messageType = messageType.toLowerCase();
	    if (this.Hooks.hasOwnProperty(messageType) && Object.prototype.toString.call(this.Hooks[messageType]) === '[object Array]') {
	        var callbacks = this.Hooks[messageType];
	        for (var item in callbacks) {
	            var callback = callbacks[item];
	            callback(messageResponse);
	        }
	    }
	},
	/**
	 * Registers a function that will be executed when a certain message type is recieved
	 * @function
	 * @name registerMessageHook
	 * @memberof communicationManager
	 * @param {string} messageType - response message type.
	 * @param {function} callback - function that accepts 1 param (object) that will be executed when messageType is recieved and the response object will be passed to the function's first param.
	 *@example
	* communicationManager.registerMessageHook("research", function(e){
	*	console.log(e._msg);
	* });
	*
	*/
	registerMessageHook: function (messageType, callback) {
	    if (messageType instanceof Array) {
	        for (var item in messageType) {
	            var messageTypeStr = (messageType[item]).toString().toLowerCase();

	            if (!(this.Hooks.hasOwnProperty(messageTypeStr) && Object.prototype.toString.call(this.Hooks[messageTypeStr]) === '[object Array]')) {
	                this.Hooks[messageTypeStr] = [];
	            }
	            this.Hooks[messageTypeStr].push(callback);
	        }
	    } else {
	        var messageTypeStr = (messageType).toString().toLowerCase();
	        if (!(this.Hooks.hasOwnProperty(messageTypeStr) && Object.prototype.toString.call(this.Hooks[messageTypeStr]) === '[object Array]')) {
	            this.Hooks[messageTypeStr] = [];
	        }
	        this.Hooks[messageTypeStr].push(callback);
	    }
	},
	/*
	 * @property {object} Hooks - Hooks object that holds all hooked messages and their functions.
	 * @memberof communicationManager
	 */
    Hooks: {}
};
window.communicationManager = communicationManager;