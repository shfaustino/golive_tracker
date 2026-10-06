"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const adminRules = require("./loadUi5Module")("model/adminRules.js");

test("validatePerson needs a name, a valid email and a profile", () => {
    assert.deepEqual(Object.keys(adminRules.validatePerson({})).sort(), ["email", "name", "profile"]);
    assert.equal(adminRules.validatePerson({ name: "Ana", email: "ana@", profile: "User" }).email, "admErrorEmail");
    assert.deepEqual(adminRules.validatePerson({ name: "Ana", email: "ana@amt.pt", profile: "User" }), {});
});

test("validateClient needs a name; a NIF, when given, has nine digits", () => {
    assert.equal(adminRules.validateClient({}).name, "pfErrorRequired");
    assert.equal(adminRules.validateClient({ name: "X", taxId: "12345" }).taxId, "admErrorTaxId");
    assert.deepEqual(adminRules.validateClient({ name: "X", taxId: "" }), {});
    assert.deepEqual(adminRules.validateClient({ name: "X", taxId: "500000001" }), {});
});

test("personBody trims and lower-cases the email", () => {
    assert.deepEqual(adminRules.personBody({ name: " Ana Silva ", email: " Ana.Silva@AMT.pt ", profile: "Architect" }),
        { name: "Ana Silva", email: "ana.silva@amt.pt", profile: "Architect", active: true });
});

test("clientBody sends empty optional fields as null", () => {
    assert.deepEqual(adminRules.clientBody({ name: " X ", taxId: "", erpCode: " E1 ", active: false }),
        { name: "X", taxId: null, erpCode: "E1", active: false });
});

test("changes sends only what changed, empty strings as null", () => {
    const oBefore = { name: "X", taxId: null, erpCode: "E1", active: true };

    assert.deepEqual(adminRules.changes(oBefore, { name: "X", taxId: "", erpCode: "E2", active: false }, adminRules.CLIENT_FIELDS),
        { erpCode: "E2", active: false });
});
