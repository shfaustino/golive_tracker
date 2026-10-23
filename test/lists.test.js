"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const lists = require("./loadUi5Module")("model/lists.js");

test("names, and the active ones in order, from the lists the API gives", () => {
    lists.set(
        [{ code: "EC", name: "Employee Central", active: true }, { code: "AB", name: "Old", active: false }],
        [{ code: "Testing", name: "Testes", sortOrder: 50, active: true }, { code: "KO", name: "Kick-off", sortOrder: 10, active: true },
            { code: "UAT", name: "UAT", sortOrder: 55, active: false }]
    );

    assert.equal(lists.moduleName("EC"), "Employee Central");
    assert.equal(lists.moduleName("AB"), "Old");
    assert.equal(lists.moduleName("XX"), "");
    assert.equal(lists.typeName("KO"), "Kick-off");
    assert.equal(lists.typeName("XX"), "");
    assert.deepEqual(lists.activeModules().map((m) => m.code), ["EC"]);
    assert.deepEqual(lists.activeTypes().map((t) => t.code), ["KO", "Testing"]);
    assert.deepEqual(lists.moduleCodes(), ["AB", "EC"]);
});
