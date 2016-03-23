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


* Download [PhantomJS][3] (2.x)
* API [PhantomJS][4]


## License

MIT

----------------------------------
[@ Daeren][1]
[@ Telegram][2]


[1]: http://666.io
[2]: https://telegram.me/io666

[3]: http://phantomjs.org
[4]: http://phantomjs.org/api/webpage/
