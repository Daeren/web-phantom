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

var gArgs     = rSystem.args,
    gPort     = gArgs[1];

var gPage     = rWebPage.create();

var gPages    = {};

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

    if(!pageId) {
        switch(event) {
            case "createPage":
                var newPageId     = pageId + 1,
                    newPage       = rWebPage.create();

                gPages[newPageId] = newPage;

                bindNotifications(newPageId, newPage);
                sendPacket([newPageId, "pageCreated"]);

                break;

            case "injectJs":
                var filename  = payload[2];
                var result    = phantom.injectJs(filename);

                sendPacket([0, "jsInjected", result]);

                break;

            case "addCookie":
                var filename  = payload[2];
                var result    = phantom.addCookie(filename);

                sendPacket([0, "cookieAdded", result]);

                break;

            case "exit":
                sendPacket([0, "phantomExited"]); //optimistically to get the response back before the line is cut

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
        case "pageOpen":
            var url = payload[2];

            page.open(url);

            break;

        case "pageOpenWithCallback":
            var url = payload[2];

            page.open(url, function(status) {
                sendPacket([pageId, "pageOpened", status]);
            });

            break;

        case "pageClose":
            page.close();
            sendPacket([pageId, "pageClosed"]);

            break;

        case "pageInjectJs":
            var url       = payload[2];
            var result    = page.injectJs(url);

            sendPacket([pageId, "pageJsInjected", JSON.stringify(result)]);

            break;

        case "pageIncludeJs":
            var url       = payload[2];

            var already     = false;

            page.includeJs(url, function() {
                if(!already) {
                    sendPacket([pageId, "pageJsIncluded"]);
                    already = true;
                }
            });

            break;

        case "pageSendEvent":
            var event = payload[2],
                x     = payload[3],
                y     = payload[4];

            page.sendEvent(event, x, y);
            sendPacket([pageId, "pageEventSent"]);

            break;

        case "pageUploadFile":
            var selector = payload[2],
                filename = payload[3];

            page.uploadFile(selector, filename);
            sendPacket([pageId, "pageFileUploaded"]);

            break;

        case "pageEvaluate":
            var args      = payload[2];
            var result    = gPage.evaluate.apply(gPage, args);

            sendPacket([pageId, "pageEvaluated", JSON.stringify(result)]);

            break;

        case "pageEvaluateAsync":
            var args = payload[2];

            gPage.evaluateAsync.apply(gPage, args);
            sendPacket([pageId, "pageEvaluatedAsync"]);

            break;

        case "pageRender":
            var filename = payload[2];

            page.render(filename);
            sendPacket([pageId, "pageRendered"]);

            break;

        case "pageRenderBase64":
            var extension = payload[2];
            var result    = page.renderBase64(extension);

            sendPacket([pageId, "pageRenderBase64Done",  result]);

            break;

        case "pageSet":
            var name  = payload[2],
                value = payload[3];

            page[name] = value;
            sendPacket([pageId, "pageSetDone"]);

            break;

        case "pageGet":
            var name      = payload[2];
            var result    = page[name];

            sendPacket([pageId, "pageGetDone", JSON.stringify(result)]);

            break;

        case "pageSetFn":
            var pageCallbackName  = payload[2],
                fn                = payload[3];

            page[pageCallbackName] = eval("(" + fn + ")");

            break;

        case "pageSetViewport":
            var viewportW = payload[2],
                viewportH = payload[3];

            page.viewportSize = {"width": viewportW, "height": viewportH};

            sendPacket([pageId, "pageSetViewportDone"]);

            break;

        default:
            console.error("unrecognized request:" + request);

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

                push([pageId, callbackName, arguments]);
            }
        });

    //---------]>

    function push(data) {
        gPage.evaluate("function(){socket.emit('notification'," + JSON.stringify(data) + ");}");
    }
}