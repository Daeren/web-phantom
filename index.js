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

    params          = params || {};
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
                      phantomProc   = spawnPhantom(params, srvPort);

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
                            case "pageCreated":
                                const pageProxy = {
                                    open(url, callback) {
                                        return sendCommand([pageId, "pageOpenWithCallback", url], callback);
                                    },
                                    close(callback) {
                                        return sendCommand([pageId, "pageClose"], callback);
                                    },
                                    render(filename, callback) {
                                        return sendCommand([pageId, "pageRender", filename], callback);
                                    },
                                    renderBase64(extension, callback) {
                                        return sendCommand([pageId, "pageRenderBase64", extension], callback);
                                    },
                                    injectJs(url, callback) {
                                        return sendCommand([pageId, "pageInjectJs", url], callback);
                                    },
                                    includeJs(url, callback) {
                                        return sendCommand([pageId, "pageIncludeJs", url], callback);
                                    },
                                    sendEvent(event, x, y, callback) {
                                        return sendCommand([pageId, "pageSendEvent", event, x, y], callback);
                                    },
                                    uploadFile(selector, filename, callback) {
                                        return sendCommand([pageId, "pageUploadFile", selector, filename], callback);
                                    },
                                    evaluate(evaluator, callback) {
                                        return sendCommand([pageId, "pageEvaluate", [evaluator.toString()].concat(Array.prototype.slice.call(arguments, 2))], callback);
                                    },
                                    evaluateAsync(evaluator, callback) {
                                        return sendCommand([pageId, "pageEvaluateAsync", [evaluator.toString()].concat(Array.prototype.slice.call(arguments, 2))], callback);
                                    },
                                    set(name, value, callback) {
                                        return sendCommand([pageId, "pageSet", name, value], callback);
                                    },
                                    get(name, callback) {
                                        return sendCommand([pageId, "pageGet", name], callback);
                                    },
                                    setFn(pageCallbackName, fn, callback) {
                                        return sendCommand([pageId, "pageSetFn", pageCallbackName, fn.toString()], callback);
                                    },
                                    setViewport(viewport, callback) {
                                        return sendCommand([pageId, "pageSetViewport", viewport.width, viewport.height], callback);
                                    }
                                };

                                pages[pageId] = pageProxy;

                                onEndClientEvent(null, pageProxy);

                                break;

                            case "phantomExited":
                                sendCommand([0, "exitAck"]);

                                server.close();
                                socketIo.set("client store expiration", 0);

                                onEndClientEvent(null);

                                break;

                            case "pageJsInjected":
                            case "jsInjected":
                                onEndClientEvent(JSON.parse(data) === true ? null : true);

                                break;

                            case "pageOpened":
                                onEndClientEvent(null, data);

                                break;

                            case "pageRenderBase64Done":
                                onEndClientEvent(null, data);

                                break;

                            case "pageGetDone":
                            case "pageEvaluated":
                                onEndClientEvent(null, JSON.parse(data));

                                break;

                            case "pageClosed":
                                delete pages[pageId];

                            case "pageSetDone":
                            case "pageJsIncluded":
                            case "cookieAdded":
                            case "pageRendered":
                            case "pageEventSent":
                            case "pageFileUploaded":
                            case "pageSetViewportDone":
                            case "pageEvaluatedAsync":
                                onEndClientEvent(null);

                                break;

                            default:
                                console.error("got unrecognized response:" + response);

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

                    phantomProc.on("error", function(error) {
                        server.close();
                        throw error;
                    });

                    phantomProc.on("exit", function(code) {
                        server.close();
                        throw new Error("Phantom crash | code: %s", code);
                    });

                    //---)>

                    phantomProc.stdout.on("data", function(data) {
                        console.log("Phantom stdout: %s", data);
                    });

                    phantomProc.stderr.on("data", function(data) {
                        console.log("Phantom stderr: %s", data);
                    });

                    //--------------]>

                    (function() {
                        const proxy = {
                            createPage(url, callback) {
                                return sendCommand([0, "createPage"], callback);
                            },

                            injectJs(filename, callback) {
                                return sendCommand([0, "injectJs", filename], callback);
                            },

                            addCookie(cookie, callback) {
                                return sendCommand([0, "addCookie", cookie], callback);
                            },

                            exit(callback) {
                                //phantom.removeListener("exit", prematureExitHandler); //an exit is no longer premature now
                                return sendCommand([0, "exit"], callback);
                            },

                            on() {
                                phantomProc.on.apply(phantomProc, arguments);
                            }
                        };

                        let count = 5;

                        const tmCheckPhantom = setInterval(function() {
                            if(!count) {
                                server.close();
                                callback(new Error("Timeout: the phantom failed to connect."), proxy);
                            }

                            if(phantomConnected) {
                                clearInterval(tmCheckPhantom);
                                callback(null, proxy);
                            }

                            count--;
                        }, 1000);
                    })();

                    //--------------]>

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
            });

    }
}

//-----------------------------]>

function spawnPhantom(params, port){
    const options   = params.args;
    const args      = [];

    for(let name in options) {
        args.push("--" + name + "=" + options[name]);
    }

    args.push(__dirname + "/bridge.js");
    args.push(port);

    //----------]>

    return rChildProcess.spawn(params.path, args);
}