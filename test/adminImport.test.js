"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const adminImport = require("./loadUi5Module")("model/adminImport.js");

const KNOWN = { emails: ["ana.silva@amt.pt"], names: ["Cliente A"], taxIds: ["500100200"] };
const errorsOf = (oRow) => oRow.errors.map((e) => e.key + (e.value ? ":" + e.value : "")).sort();

test("people: the body as Nova pessoa sends it, the profile in Portuguese or not, User by default", () => {
    const aRows = adminImport.read([adminImport.templateRows("person")[0],
        ["Rui Costa", " Rui.Costa@AMT.pt ", "Arquiteto"],
        ["Marta Sousa", "marta@amt.pt", ""],
        ["Paulo Reis", "paulo@amt.pt", "Administrator"]
    ], "person", KNOWN);

    assert.deepEqual(aRows.map((r) => r.body), [
        { name: "Rui Costa", email: "rui.costa@amt.pt", profile: "Architect", active: true },
        { name: "Marta Sousa", email: "marta@amt.pt", profile: "User", active: true },
        { name: "Paulo Reis", email: "paulo@amt.pt", profile: "Administrator", active: true }
    ]);
    assert.equal(aRows[0].detail, "rui.costa@amt.pt");
});

test("people: says what is wrong, and makes no body for it", () => {
    const aRows = adminImport.read([["Email", "Nome", "Perfil"],
        ["ana.silva@amt.pt", "Ana", "Chefe"],
        ["nao-e-email", "", ""],
        ["novo@amt.pt", "Novo", ""],
        ["NOVO@amt.pt", "Outro", ""]
    ], "person", KNOWN);

    assert.deepEqual(errorsOf(aRows[0]), ["impErrorEmailTaken:ana.silva@amt.pt", "impErrorProfile:Chefe"]);
    assert.deepEqual(errorsOf(aRows[1]), ["admErrorEmail", "pfErrorRequired"]);
    assert.deepEqual(aRows[2].errors, []);
    assert.deepEqual(errorsOf(aRows[3]), ["impErrorEmailRepeated:novo@amt.pt"]);
    assert.equal(aRows[0].body, null);
});

test("clients: unique name and NIF, a NIF of nine digits", () => {
    const aRows = adminImport.read([adminImport.templateRows("client")[0],
        ["Cliente B", "501000000", "ERP-2"],
        ["cliente a", "500100200", ""],
        ["Cliente C", "123", ""],
        ["", "", "ERP-9"]
    ], "client", KNOWN);

    assert.deepEqual(aRows[0].body, { name: "Cliente B", taxId: "501000000", erpCode: "ERP-2", active: true });
    assert.deepEqual(errorsOf(aRows[1]), ["impErrorNameTaken:cliente a", "impErrorTaxIdTaken:500100200"]);
    assert.deepEqual(errorsOf(aRows[2]), ["admErrorTaxId"]);
    assert.deepEqual(errorsOf(aRows[3]), ["pfErrorRequired"]);
});
