const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const htmlPath = path.join(dir, "index.html");
const jsPath = path.join(dir, "index.js");
const cssPath = path.join(dir, "index.css");

const html = fs.readFileSync(htmlPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

const inlined = html
  .replace(
    '<script type="module" crossorigin src="./index.js"></script>',
    '<script type="module" crossorigin>\n' + js + "\n</script>",
  )
  .replace(
    '<link rel="stylesheet" crossorigin href="./index.css">',
    "<style>\n" + css + "\n</style>",
  );

fs.writeFileSync(htmlPath, inlined);
console.log(
  "Inlined! Size:",
  (Buffer.byteLength(inlined, "utf8") / 1024 / 1024).toFixed(1),
  "MB",
);
