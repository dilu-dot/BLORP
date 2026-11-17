"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const main = fs.readFileSync("desktop/main.js", "utf8");
for (const fragment of ["sandbox: true", "nodeIntegration: false", "contextIsolation: true", "https:", "blorp://app/index.html", "persist:blorp-customer"]) {
  assert.ok(main.includes(fragment), "Missing security/desktop feature: " + fragment);
}
for (const file of ["public/index.html", "public/assets/base.css", "public/assets/base.js", "public/assets/v53.js"]) {
  assert.ok(fs.existsSync(file), "Missing customer UI: " + file);
}
assert.equal(fs.existsSync("owner-ui"), false, "Private Owner UI must not be copied into customer app");
console.log("Blorp AI desktop source checks passed.");
