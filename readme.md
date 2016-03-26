```
npm install web-phantom
```

```js
const rWebPhantom   = require("web-phantom"),
      rCo           = require("co");
      
rCo(function* () {
    const ph        = yield rWebPhantom();

    const page      = yield ph.createPage();

    const status    = yield page.open("https://db.gg"),
          content   = yield page.content();

    console.log("Page (%s):\n\n%s", status, content);

    yield page.close();
    yield ph.exit();
}).catch(console.error);
```


1. Download [PhantomJS][3] (2.x)
2. Run PhantomJS in the console: "> phantomjs -v"
3. Run node.js applications


* API [PhantomJS][4]
* Command-line [PhantomJS][5]


## License

MIT

----------------------------------
[@ Daeren][1]
[@ Telegram][2]


[1]: http://666.io
[2]: https://telegram.me/io666

[3]: http://phantomjs.org
[4]: http://phantomjs.org/api/webpage/
[5]: http://phantomjs.org/api/command-line.html
