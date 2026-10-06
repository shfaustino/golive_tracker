"use strict";

// Loads a dependency-free UI5 module (sap.ui.define with no imports, such as
// webapp/model/*.js) in Node, so its logic can be tested with node --test
// without a browser. It runs in this realm and not in a vm context, so the
// objects it returns compare equal (deepStrictEqual checks prototypes).

const fs = require("node:fs");
const path = require("node:path");

module.exports = function loadUi5Module(sRelativePath) {
    const sFile = path.join(__dirname, "..", "webapp", sRelativePath);
    let oExport;
    const sap = {
        ui: {
            define: function (aDeps, fnFactory) {
                oExport = fnFactory();
            }
        }
    };

    new Function("sap", fs.readFileSync(sFile, "utf8"))(sap);
    return oExport;
};
