//-----------------------------------------------------
//
// Author: Daeren
// Site: 666.io
//
//-----------------------------------------------------

"use strict";

//-----------------------------------------------------

var rSystem           = require("system"),
    rWebPage          = require("webpage"),
    rWebServer        = require("webserver");

//-----------------------------------------------------

var C_SYS_PAGE_ID   = 0;

var gArgs           = rSystem.args,
    gPort           = gArgs[1];

var gPage           = rWebPage.create();

var gPages          = {};

//-----------------------------------------------------

gPage.open("http://localhost:" + gPort, function(status) {
    console.log("Opened:", status, gPort);
});

//-----------------------------------------------------

gPage.onConsoleMessage = function onConsoleMessage(msg) {
    console.log("console.log: %s", msg);
};

gPage.onAlert = function onAlert(packet) {
    packet = JSON.parse(packet);

    //------------]>

    var cmdId       = packet[0],
        payload     = packet[1];

    var pageId      = payload[0],
        event       = payload[1];

    //------------]>

    if(pageId === C_SYS_PAGE_ID) {
        switch(event) {
            case "createPage":
                var newPageId     = pageId + 1,
                    newPage       = rWebPage.create();

                gPages[newPageId] = newPage;

                bindNotifications(newPageId, newPage);
                sendPacket([newPageId, "createPage"]);

                break;

            case "injectJs":
                var filename  = payload[2];
                var result    = phantom.injectJs(filename);

                sendPacket([C_SYS_PAGE_ID, "injectJs", result]);

                break;

            case "addCookie":
                var filename  = payload[2];
                var result    = phantom.addCookie(filename);

                sendPacket([C_SYS_PAGE_ID, "addCookie", result]);

                break;

            case "exit":
                sendPacket([C_SYS_PAGE_ID, "exit"]); //optimistically to get the response back before the line is cut

                break;

            case "exitAck":
                phantom.exit();

                break;

            default:
                console.error("unrecognized request:" + request);

                break;
        }

        return;
    }

    //------------]>

    var page = gPages[pageId];

    switch(event) {
        case "open":
            var url = payload[2];

            page.open(url, function(status) {
                sendPacket([pageId, "open", status]);
            });

            break;

        case "close":
            page.close();
            sendPacket([pageId, "close"]);

            break;

        //---)>

        case "render":
            var filename = payload[2];

            page.render(filename);
            sendPacket([pageId, "render"]);

            break;

        case "renderBase64":
            var extension = payload[2];
            var result    = page.renderBase64(extension);

            sendPacket([pageId, "renderBase64",  result]);

            break;

        //---)>

        case "injectJs":
            var url       = payload[2];
            var result    = page.injectJs(url);

            sendPacket([pageId, "injectJs", JSON.stringify(result)]);

            break;

        case "includeJs":
            var url       = payload[2];

            var already     = false;

            page.includeJs(url, function() {
                if(!already) {
                    sendPacket([pageId, "includeJs"]);
                    already = true;
                }
            });

            break;

        //---)>

        case "sendEvent":
            var event = payload[2],
                x     = payload[3],
                y     = payload[4];

            page.sendEvent(event, x, y);
            sendPacket([pageId, "sendEvent"]);

            break;

        case "uploadFile":
            var selector = payload[2],
                filename = payload[3];

            page.uploadFile(selector, filename);
            sendPacket([pageId, "uploadFile"]);

            break;

        //---)>

        case "evaluate":
            var args      = payload[2];
            var result    = page.evaluate.apply(page, args);

            sendPacket([pageId, "evaluate", JSON.stringify(result)]);

            break;

        case "evaluateAsync":
            var args = payload[2];

            page.evaluateAsync.apply(page, args);
            sendPacket([pageId, "evaluateAsync"]);

            break;

        //---)>

        case "viewportSize":
            var viewportW = payload[2],
                viewportH = payload[3];

            page.viewportSize = {"width": viewportW, "height": viewportH};

            sendPacket([pageId, "viewportSize"]);

            break;

        case "content":
        case "cookies":
        case "scrollPosition":
            var data = payload[2];

            if(typeof(data) !== "undefined" && data !== null) {
                page[event] = data;
            }

            sendPacket([pageId, event, page[event]]);

            break;

        //---)>

        default:
            console.error("Unrecognized request: %s", request);

            break;
    }

    //------------------]>

    function sendPacket(packet) {
        gPage.evaluate('function(){socket.emit("packet",' + JSON.stringify([cmdId, packet]) + ');}');
    }
};

//-----------------------------------------------------

function bindNotifications(pageId, page) {
    [
        "onAlert", "onCallback", "onClosing", "onConfirm", "onConsoleMessage", "onError",
        "onFilePicker", "onInitialized", "onLoadFinished", "onLoadStarted", "onNavigationRequested",
        "onPageCreated", "onPrompt", "onResourceError", "onResourceReceived", "onResourceRequested",
        "onResourceTimeout", "onUrlChanged"
    ]
        .forEach(function(callbackName) {
            page[callbackName] = sendNotification;

            function sendNotification(params) {
                if(callbackName === "onResourceRequested" && params.url.indexOf("data:image") >= 0) {
                    return;
                }

                push([pageId, callbackName, Array.prototype.slice.call(arguments)]);
            }
        });

    //---------]>

    function push(data) {
        gPage.evaluate("function(){socket.emit('notification'," + JSON.stringify(data) + ");}");
    }
}