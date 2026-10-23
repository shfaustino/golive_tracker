"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const adminTabs = require("./loadUi5Module")("model/adminTabs.js");
const adminRules = require("./loadUi5Module")("model/adminRules.js");

test("a record's path: by ID, or by code with the code encoded", () => {
    assert.equal(adminTabs.path("pessoas", { ID: "a1" }), "/People(a1)");
    assert.equal(adminTabs.path("modulos", { code: "P&G" }), "/Modules('P%26G')");
    assert.equal(adminTabs.path("tipos", { code: "Report delivery" }), "/MilestoneTypes('Report%20delivery')");
    assert.equal(adminTabs.path("modulos", { code: "O'X" }), "/Modules('O''X')");
});

test("each route opens its tab", () => {
    assert.equal(adminTabs.tabOfRoute("adminModules"), "modulos");
    assert.equal(adminTabs.tabOfRoute("adminMilestoneTypes"), "tipos");
    assert.equal(adminTabs.tabOfRoute("admin"), "pessoas");
});

test("modules and milestone types: a code and a name; a type's order a whole number, 100 when left out", () => {
    assert.deepEqual(adminRules.validateModule({ code: " ", name: "" }), { code: "pfErrorRequired", name: "pfErrorRequired" });
    assert.deepEqual(adminRules.validateModule({ code: "X".repeat(21), name: "N" }), { code: "admErrorCodeLength" });
    assert.deepEqual(adminRules.validateType({ code: "UAT", name: "UAT", sortOrder: "5a" }), { sortOrder: "admErrorOrder" });
    assert.deepEqual(adminRules.typeBody({ code: " UAT ", name: " Testes ", requiresAudit: true, sortOrder: "" }),
        { code: "UAT", name: "Testes", requiresAudit: true, sortOrder: 100, active: true });
    assert.deepEqual(adminRules.moduleBody({ code: "SF-RCM", name: "Recruiting Marketing" }),
        { code: "SF-RCM", name: "Recruiting Marketing", active: true });
});
