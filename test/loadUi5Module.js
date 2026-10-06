"use strict";

// Loads a UI5 module of the app (sap.ui.define) in Node, so its logic can be
// tested with node --test without a browser. Relative imports ("./auditRules")
// are loaded the same way; UI5's own modules cannot be, so the modules tested
// here import only each other. It runs in this realm and not in a vm
// context, so the objects it returns compare equal (deepStrictEqual checks
// prototypes).

const fs = require("node:fs");
const path = require("node:path");

const WEBAPP = path.join(__dirname, "..", "webapp");
const cache = new Map();

function load(sFile) {
    if (cache.has(sFile)) {
        return cache.get(sFile);
    }
    let oExport;
    const sap = {
        ui: {
            define: function (aDeps, fnFactory) {
                const aModules = (aDeps || []).map(function (sDep) {
                    if (!sDep.startsWith(".")) {
                        throw new Error(sFile + " imports " + sDep + ", which cannot be loaded in Node");
                    }
                    return load(path.join(path.dirname(sFile), sDep + ".js"));
                });

                oExport = fnFactory.apply(null, aModules);
            }
        }
    };

    new Function("sap", fs.readFileSync(sFile, "utf8"))(sap);
    cache.set(sFile, oExport);
    return oExport;
}

module.exports = function loadUi5Module(sRelativePath) {
    return load(path.join(WEBAPP, sRelativePath));
};
