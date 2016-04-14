//-----------------------------------------------------
//
// Author: Daeren
// Site: 666.io
//
//-----------------------------------------------------

"use strict";

//-----------------------------------------------------

const rWebPhantom   = require("./../index"),
      rCo           = require("co");

//-----------------------------------------------------

global.sleep = t => new Promise(r => setTimeout(r, t));

//-----------------------------------------------------

rCo(function* () {
    const ph        = yield rWebPhantom();
    const page      = yield ph.createPage();

    const status    = yield page.open("https://666.io");

    yield sleep(1000 * 5);

    const content   = yield page.content();

    yield page.render("test.png");

    console.log("Page (%s):\n\n%s", status, content);

    yield page.close();
    yield ph.exit();
}).catch(console.error);



/*
rCo(function* () {
    const params = {
        "log":  true,
        "args": {
            "cookies-file": "./cookies.txt",
            "load-images":  false,
            "proxy":        "94.205.81.171:80"
        }
    };

    const ph        = yield rWebPhantom(params);
    const page      = yield ph.createPage();

    const status    = yield page.open("https://db.gg");

    yield sleep(1000 * 5);

    const content   = yield page.content();

    console.log("Page (%s):\n\n%s", status, content);

    yield page.close();
    yield ph.exit();
}).catch(console.error);
*/



/*
const params = {"log": true, "args": {}};

rWebPhantom(params, function(error, ph) {
    console.log("createPage");

    ph.createPage(function(error, page) {
        console.log("open");

        page.open("https://db.gg" ,function(error, status) {
            console.log("Page: %s", status);
        });
    });
});
*/


// http://checkip.amazonaws.com/
