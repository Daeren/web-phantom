```
npm install web-phantom
```

```js
const rWebPhantom   = require("web-phantom"),
      rCo           = require("co");
      
rCo(function* () {
    const ph        = yield rWebPhantom();

    const page      = yield ph.createPage();
    const status    = yield page.open("https://db.gg");

    console.log("Page: %s", status);
}).catch(console.error);
```

## License

MIT

----------------------------------
[@ Daeren][1]
[@ Telegram][2]


[1]: http://666.io
[2]: https://telegram.me/io666
