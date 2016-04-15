//-----------------------------------------------------
//
// Author: Daeren
// Site: 666.io
//
//-----------------------------------------------------

"use strict";

//-----------------------------------------------------

const rHttp             = require("http"),
      rChildProcess     = require("child_process");

const rSocketIo         = require("socket.io");

//-----------------------------------------------------

const C_SYS_PAGE_ID = 0;

const gClientJs = '<html><head><script src="/socket.io/socket.io.js"></script><script>\n\
                window.onload = function(){\n\
                    (window.socket = new io()).on("packet", function(t){alert(t);});\n\
                };\n\
            </script></head><body></body></html>';

//-----------------------------------------------------

module.exports = main;

//-----------------------------------------------------

function main(params, callback) {
    if(typeof(params) === "function") {
        callback = params;
        params = null;
    }

    params          = params ? Object.create(params) : {};
    params.path     = params.path || "phantomjs";
    params.host     = params.host || "localhost";
    params.args     = params.args || {};

    if(typeof(callback) === "undefined") {
        return new Promise(cbPromise);
    }

    //-------------------------]>

    cbPromise();

    //-------------------------]>

    function cbPromise(resolve, reject) {
        callback = callback || ((error, result) => error ? reject(error) : resolve(result));

        //----------]>

        let phantomConnected = false;

        //----------]>

        const server = rHttp
            .createServer(function(request, response) {
                phantomConnected = true;

                response.writeHead(200, {"Content-Type": "text/html"});
                response.end(gClientJs);
            })
            .listen(params.port, params.host, function() {
                const srvPort       = server.address().port;

                const socketIo      = rSocketIo(server),
                      phantomProc   = runPhantom(params);

                const pages         = {},
                      commands      = {};

                let cmdId           = 0;

                //--------------]>

                socketIo.on("connection", function(socket) {
                    socket.on("notification", function(request) {
                        const pageId    = request[0],
                              cmd       = request[1],
                              data      = request[2];

                        const page      = pages[pageId],
                              onEvent   = page && page[cmd];

                        if(onEvent) {
                            onEvent.apply(onEvent, data);
                        }
                    });

                    socket.on("packet", function(response) {
                        const packet        = response;

                        const cmdId         = packet[0],
                              payload       = packet[1];

                        const pageId        = payload[0],
                              event         = payload[1],
                              data          = payload[2];

                        const command       = commands[cmdId];

                        //-------]>

                        switch(event) {
                            case "createPage":
                                onEndClientEvent(null, pages[pageId] = createPageProxy(pageId));

                                break;

                            case "exit":
                                sendCommand([0, "exitAck"]);

                                server.close();

                                onEndClientEvent(null);

                                break;

                            //---)>

                            case "open":
                            case "content":
                            case "cookies":
                            case "scrollPosition":
                            case "renderBase64":
                                onEndClientEvent(null, data);

                                break;

                            case "injectJs":
                                onEndClientEvent(JSON.parse(data) === true ? null : true);

                                break;

                            case "evaluate":
                                onEndClientEvent(null, JSON.parse(data));

                                break;

                            //---)>

                            case "close":
                                delete pages[pageId];

                            case "cookieAdded":
                            case "render":
                            case "includeJs":
                            case "sendEvent":
                            case "uploadFile":
                            case "evaluateAsync":

                            case "viewportSize":
                                onEndClientEvent(null);

                                break;

                            default:
                                console.error("Unrecognized response: %s", response);

                                break;
                        }

                        //-------]>

                        function onEndClientEvent(error, result) {
                            if(!command) {
                                return;
                            }

                            const commandCallback = command.callback;

                            if(commandCallback) {
                                commandCallback(error, result);
                            }

                            delete commands[cmdId];
                        }
                    });

                    //--------------]>

                    if(params.log) {
                        phantomProc.stdout.on("data", onPhantomStdout);
                        phantomProc.stderr.on("data", onPhantomStderr);
                    }

                    //--------------]>

                    (function() {
                        const tmCheckPhantom = setInterval(onPhantomCheck, 1000);

                        let count = 5;

                        function onPhantomCheck() {
                            if(phantomConnected) {
                                clearInterval(tmCheckPhantom);
                                callback(null, Object.assign(Object.create(phantomProc), createPhantomProxy()));
                            }
                            else if(!count) {
                                server.close();
                                callback(new Error("Timeout: the phantom failed to connect."));
                            }

                            count--;
                        }
                    })();

                    //--------------]>

                    function createPhantomProxy() {
                        return {
                            createPage(callback) {
                                return sendCommand([C_SYS_PAGE_ID, "createPage"], callback);
                            },

                            injectJs(filename, callback) {
                                return sendCommand([C_SYS_PAGE_ID, "injectJs", filename], callback);
                            },

                            addCookie(cookie, callback) {
                                return sendCommand([C_SYS_PAGE_ID, "addCookie", cookie], callback);
                            },

                            exit(callback) {
                                return sendCommand([C_SYS_PAGE_ID, "exit"], callback);
                            }
                        };
                    }

                    function createPageProxy(pageId) {
                        return {
                            open(url, callback) {
                                return sendCommand([pageId, "open", url], callback);
                            },
                            close(callback) {
                                return sendCommand([pageId, "close"], callback);
                            },

                            render(filename, callback) {
                                return sendCommand([pageId, "render", filename], callback);
                            },
                            renderBase64(extension, callback) {
                                return sendCommand([pageId, "renderBase64", extension], callback);
                            },

                            injectJs(url, callback) {
                                return sendCommand([pageId, "injectJs", url], callback);
                            },
                            includeJs(url, callback) {
                                return sendCommand([pageId, "includeJs", url], callback);
                            },

                            sendEvent(event, x, y, callback) {
                                return sendCommand([pageId, "sendEvent", event, x, y], callback);
                            },
                            uploadFile(selector, filename, callback) {
                                return sendCommand([pageId, "uploadFile", selector, filename], callback);
                            },

                            evaluate(evaluator, callback) {
                                return sendCommand([pageId, "evaluate", [evaluator.toString()].concat(Array.prototype.slice.call(arguments, 2))], callback);
                            },
                            evaluateAsync(evaluator, callback) {
                                return sendCommand([pageId, "evaluateAsync", [evaluator.toString()].concat(Array.prototype.slice.call(arguments, 2))], callback);
                            },

                            viewportSize(viewport, callback) {
                                return sendCommand([pageId, "viewportSize", viewport.width, viewport.height], callback);
                            },
                            content(data, callback) {
                                return sendCommand([pageId, "content", data], callback);
                            },
                            cookies(data, callback) {
                                return sendCommand([pageId, "cookies", data], callback);
                            },
                            scrollPosition(data, callback) {
                                return sendCommand([pageId, "scrollPosition", data], callback);
                            }
                        };
                    }

                    function sendCommand(args, callback) {
                        const packet    = [cmdId, args],
                              command   = commands[cmdId] = {};

                        socket.emit("packet", JSON.stringify(packet));

                        cmdId++;

                        if(typeof(callback) === "undefined") {
                            return new Promise(cbPromise);
                        }

                        //-------------------------]>

                        cbPromise();

                        //-------------------------]>

                        function cbPromise(resolve, reject) {
                            command.callback = callback || ((error, result) => error ? reject(error) : resolve(result));
                        }
                    }
                });

                //--------------]>

                function runPhantom(p) {
                    const ph = spawnPhantom(p, srvPort);

                    ph.on("error", onPhantomError);
                    ph.on("exit", onPhantomExit);

                    return ph;
                }

                //-----]>

                function onPhantomStdout(data) {
                    console.log("Phantom stdout: %s", data);
                }

                function onPhantomStderr(data) {
                    console.log("Phantom stderr: %s", data);
                }

                function onPhantomError(error) {
                    onPhantomRelease();
                    server.close();

                    throw error;
                }

                function onPhantomExit(code) {
                    if(code === 0) {
                        return;
                    }

                    onPhantomRelease();
                    server.close();

                    throw new Error("Phantom crash | code: %s", code);
                }

                function onPhantomRelease() {
                    phantomProc.stdout.removeListener("data", onPhantomStdout);
                    phantomProc.stderr.removeListener("data", onPhantomStderr);

                    phantomProc.removeListener("error", onPhantomError);
                    phantomProc.removeListener("exit", onPhantomExit);
                }
            });
    }
}

//-----------------------------]>

function spawnPhantom(params, port){
    const options   = params.args;
    const args      = [];

    //----------]>

    for(let name in options) {
        args.push("--" + name + "=" + options[name]);
    }

    args.push(__dirname + "/bridge.js");
    args.push(port);

    //----------]>

    return rChildProcess.spawn(params.path, args);
}