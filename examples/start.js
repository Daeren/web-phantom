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

rCo(function* () {
    const ph = yield rWebPhantom();

    const page = yield ph.createPage();
    const status = yield page.open("https://db.gg");

    console.log("Page: %s", status);

    yield page.close();
    yield ph.exit();
}).catch(console.error);

/*
rWebPhantom({"log": 1}, function(error, ph) {
    console.log("createPage");

    ph.createPage(function(error, page) {
        console.log("open");

        page.open("https://db.gg" ,function(error, status) {
            console.log("Page: %s", status);
        });
    });
});
*/