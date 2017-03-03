// http://usejsdoc.org/

/**
 * @classdesc Object used to comunicate with local WebSocket.
 * @class
 */
var SignerDesktopClient = (function () {

    var ws;
    var defer = [];
    var uriServer = "ws://localhost:9091/";
    var isDebug = false;

    /**
     * Log messages in console if in debug mode.
     * 
     * @private
     * @param {string} message - Message to log.
     * @memberof SignerDesktopClient
     */
    var l = function (message) {
        if (isDebug) {
            console.log(message);
        }
    };

    var services = {
		/**
         * Set URI to use in communication.
		 * 
         * @instance
		 * @default ws://localhost:9091/
         * @param {string} uri - Uri to use.
         * @memberof SignerDesktopClient
         */
        setUriServer: function (uri) {
            l("Setting URI to " + uri);
            uriServer = uri;
        },

		/**
         * Set debug true or false.
         * 
         * @instance
         * @param {boolean} isToDebug - 
         * @memberof SignerDesktopClient
         */
        setDebug: function (isToDebug) {
            l("Setting debug on to " + (isToDebug ? "ON" : "OFF"));
            isDebug = isToDebug;
        },

		/**
         * Method used to start connection with local WebSocket server.
         * 
         * @instance
         * @param {function} callbackOpen - Callback  invoked on OPEN connection.
         * @param {function} callbackClose - Callback invoked on CLOSE connection.
         * @param {function} callbackError - Callback invoked on ERROR connection.
         * @memberof SignerDesktopClient
         */
        connect: function (callbackOpen, callbackClose, callbackError) {
            if (ws == null || ws.readyState != 1) {
                l("Connecting on " + uriServer);
                ws = new WebSocket(uriServer);

                ws.onopen = function (msg) {
                    if (callbackOpen)
                        callbackOpen(msg.target.readyState);
                };

                ws.onclose = function (msg) {
                    if (callbackClose)
                        callbackClose(msg.target.readyState);
                };

                ws.onmessage = function (response) {
                    var objResponse = JSON.parse(response.data);

                    // If has data and data.error is a business error
                    if (objResponse !== undefined && objResponse.error !== undefined) {
                        if (objResponse.requestId !== undefined && defer[objResponse.requestId].hasCallbackError()) {
                            defer[objResponse.requestId].reject(objResponse);
                        } else if (callbackError) {
                            callbackError(objResponse);
                        }
                    } else {

                        l("Receiving command with ID [" + objResponse.requestId + "]");
                        
                        if (objResponse.requestId != undefined && defer[objResponse.requestId] !== undefined) {
                            defer[objResponse.requestId].resolve(objResponse);
                        } else {
                            l("No callback to success was defined.");
                            l(objResponse)
                        }
                    }
                };

                ws.onerror = function (response) {
                    if (defer[response.requestId] !== undefined) {
                        defer[response.requestId].reject(response);
                    } else {
                        l("No callback to success was defined. Generic error.");
                        callbackError(response);
                    }
                };
            }
        },

		/**
         * Verify status of connection with WebSocket server.
         * 
         * @instance
		 * @return {boolean} - True for connection is up, false if is down.  
         * @memberof SignerDesktopClient
         */
        isConnected: function () {
            if (ws != null)
                return ws.readyState == 1 ? true : false;
            return false;
        },

        /**
		 * Signer content using some parameters.
         * 
         * @instance
		 * @param {string} alias - Alias of certificate to use in sign
		 * @param {string} provider - The provider (Token, SmartCard...)
		 * @param {string} content - The text to sign
		 * @param {string} signaturePolicy - he policy to use in signature 
		 * @return Promisse - The promisse when is finished. 
		 * @memberof SignerDesktopClient
		 */
        signer: function (alias, provider, content, signaturePolicy) {
            var signerCommand = {
                command: 'signer',
                type: 'raw',
                format: 'text',
                compacted: false,
                alias: alias,
                signaturePolicy: signaturePolicy,
                provider: provider,
                content: content
            }
            var promise = services.execute(signerCommand);
            return promise;
        },

        /**
		 * Validate a signature with original content.
         * The original content and the signature
         * MUST be in base64.
         * 
         * @instance
		 * @param {string} content - The text that was signed
		 * @param {string} signed - Signature of the content 
		 * @return Promisse - The promisse when is finished. 
		 * @memberof SignerDesktopClient
		 */
        validate: function (content, signature) {
            var validateCommand = {
                command: 'validate',
                format: 'base64',
                content: content,
                signature: signature
            }
            var promise = services.execute(validateCommand);
            return promise;
        },

        /**
		 * Sign file selected by method getFiles.
         * 
         * @instance
         * @param {string} alias - Alias of certificate to use in sign
		 * @param {string} provider - The provider (Token, SmartCard...)
		 * @param {string} fileName - The file to sign
		 * @param {string} signaturePolicy - he policy to use in signature 
		 * @return Promisse - The promisse when is finished.  
		 * @memberof SignerDesktopClient
		 */
        signerFile: function (alias, provider, fileName, signaturePolicy) {
            var signerCommand = {
                command: 'filesigner',
                type: 'raw',
                format: 'text',
                compacted: false,
                alias: alias,
                signaturePolicy: signaturePolicy,
                provider: provider,
                content: fileName
            }
            var promise = services.execute(signerCommand);
            return promise;
        },

        /**
		 * Validate a signature on local machine.
         * 
         * @instance
		 * @return Promisse - The promisse when is finished. 
		 * @memberof SignerDesktopClient
		 */
        validateFile: function () {
            var validateFileCommand = {
                command: 'validatefile'
            }
            var promise = services.execute(validateFileCommand);
            return promise;
        },

        /**
		 * Sign file using default parameters: first cert on token, first provider and policy CADES 2_2.
         * 
         * @instance
		 * @return Promisse - The promisse when is finished.  
		 * @memberof SignerDesktopClient
		 */
        signerFileUsingDefaults: function () {
            var signerCommand = {
                command: 'filesignerusingdefaults',
                type: 'raw',
                format: 'text',
                compacted: false
            }
            var promise = services.execute(signerCommand);
            return promise;
        },

        /**
		 * Logout of access token.
         * 
         * @instance
		 * @memberof SignerDesktopClient
		 */
        logoutPKCS11: function () {
            var logoutPKCS11Command = {
                command: 'logoutpkcs11'
            }
            ws.send(JSON.stringify(logoutPKCS11Command));
        },

        /**
		 * Verify Desktop status. 
         * 
         * @instance
		 * @return Promisse - The promisse when is finished. 
		 * @memberof SignerDesktopClient
		 */
        status: function () {
            var statusCommand = {
                command: 'status'
            }
            var promise = services.execute(statusCommand);
            return promise;
        },

        /**
		 * List all certificates in Token.
         * 
         * @instance
		 * @return Promisse - The promisse when is finished.  
		 * @memberof SignerDesktopClient
		 */
        listCerts: function () {
            var listcertsCommand = {
                command: 'listcerts'
            }
            var promise = services.execute(listcertsCommand);
            return promise;
        },

        /**
		 * List all policies on token.
         * 
         * @instance
		 * @return Promisse - The promisse when is finished.  
		 * @memberof SignerDesktopClient
		 */
        listPolicies: function () {
            var listpoliciesCommand = {
                command: 'listpolicies'
            }
            var promise = services.execute(listpoliciesCommand);
            return promise;
        },

        /**
		 * Get files to sign. 
         * 
         * @instance
		 * @return Promisse - The promisse when is finished.  
		 * @memberof SignerDesktopClient
		 */
        getFiles: function () {
            var getfileCommand = {
                command: 'getfiles'
            }
            var promise = services.execute(getfileCommand);
            return promise;
        },

        /**
		 * Shutdown Desktop Client
         * 
         * @instance
		 * @memberof SignerDesktopClient
		 */
        shutdown: function () {
            var shutdownCommand = {
                command: 'shutdown'
            }
            ws.send(JSON.stringify(shutdownCommand));
        },

        /**
		 * Generic method to sendo commands to Desktop Server.
         * 
         * @instance
		 * @param {json} request - Request JSON content all attributes to run.
         * @return Promisse - The promisse when is finished. 
		 * @memberof SignerDesktopClient
		 */
        execute: function (request) {

            /**
             * @todo verify if ws was intancialize
             */

            // If id doesnt exists, create
            if (request.requestId === undefined || request.requestId === "") {
                request.requestId = new Date().getTime();
            }

            l("Sending command [" + request.command + "] with ID [" + request.requestId + "] to URI [" + uriServer + "]");
            l(request);

            defer[request.requestId] = new Promise();

            ws.send(JSON.stringify(request));

            return defer[request.requestId];
        },

        // ******************** Wrapper method ********************
        setUriServerWrapper: function (params) {
            l("Wrapper called");
            services.setUriServer(params.uri);
        },

        setDebugWrapper: function (params) {
            l("Wrapper called");
            services.setDebug(params.isToDebug);
        },

        connectWrapper: function (params) {
            l("Wrapper called");
            services.connect(params.callbackOpen, params.callbackClose, params.callbackError);
        },

        isConnectedWrapper: function (params) {
            l("Wrapper called");
            return services.isConnected();
        },

        signerWrapper: function (params) {
            l("Wrapper called");
            return services.signer(params.alias, params.provider, params.content, params.signaturePolicy);
        },

        validateWrapper: function (params) {
            l("Wrapper called");
            return services.validate(params.content, params.signature);
        },

        signerFileWrapper: function (params) {
            l("Wrapper called");
            return services.signerFile(params.alias, params.provider, params.fileName, params.signaturePolicy);
        },

        validateFileWrapper: function (params) {
            l("Wrapper called");
            return services.validateFile();
        },

        signerFileUsingDefaultsWrapper: function (params) {
            l("Wrapper called");
            return services.signerFileUsingDefaults();
        },

        logoutPKCS11Wrapper: function (params) {
            l("Wrapper called");
            services.logoutPKCS11();
        },

        statusWrapper: function (params) {
            l("Wrapper called");
            return services.status();
        },

        listCertsWrapper: function (params) {
            l("Wrapper called");
            return services.listCerts();
        },

        listPoliciesWrapper: function () {
            l("Wrapper called");
            return services.listPolicies();
        },

        getFilesWrapper: function () {
            l("Wrapper called");
            return services.getFiles();
        },

        shutdownWrapper: function () {
            l("Wrapper called");
            services.shutdown();
        }

    };

    return services;
})();