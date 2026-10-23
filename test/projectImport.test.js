"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const projectImport = require("./loadUi5Module")("model/projectImport.js");

const KNOWN = {
    clients: [{ ID: "c1", name: "Cliente A", taxId: "500100200" }],
    people: [{ ID: "p1", name: "Ana Silva", email: "ana.silva@amt.pt" }],
    codes: ["CO-N-0001"]
};
const HEADERS = projectImport.templateRows()[0];
const row = (o) => projectImport.COLUMNS.map(([sKey]) => o[sKey] ?? "");
const errorsOf = (oRow) => oRow.errors.map((e) => e.key + (e.value ? ":" + e.value : ""));

test("toDate reads date cells, Excel serials and typed dates", () => {
    assert.equal(projectImport.toDate(new Date(2027, 1, 1)), "2027-02-01");
    assert.equal(projectImport.toDate(46419), "2027-02-01");
    assert.equal(projectImport.toDate("01/02/2027"), "2027-02-01");
    assert.equal(projectImport.toDate("1.2.2027"), "2027-02-01");
    assert.equal(projectImport.toDate("2027-02-01"), "2027-02-01");
    assert.equal(projectImport.toDate(""), "");
    assert.equal(projectImport.toDate("amanhã"), null);
});

test("a complete row becomes the Novo projeto payload, the PM in the team", () => {
    const [oRow] = projectImport.read([HEADERS, row({
        code: "CO-N-0100", name: "Projeto X", client: "500100200", projectType: "Rollout",
        startDate: "01/02/2027", endDate: "30/11/2027", pm: "ANA.SILVA@amt.pt", modules: "EC; ECP", value: "1200,50"
    })], KNOWN);

    assert.deepEqual(oRow.errors, []);
    assert.equal(oRow.line, 2);
    assert.equal(oRow.clientName, "Cliente A");
    assert.deepEqual(oRow.payload, {
        code: "CO-N-0100", name: "Projeto X", client_ID: "c1", projectType: "Rollout",
        startDate: "2027-02-01", endDate: "2027-11-30", currency_code: "EUR",
        modules: [{ module: "EC" }, { module: "ECP" }],
        members: [{ person_ID: "p1", role: "PM", startDate: "2027-02-01" }],
        value: 1200.5
    });
});

test("says what is wrong in each row, and makes no payload for it", () => {
    const aRows = projectImport.read([HEADERS,
        row({ code: "CO-N-0001", name: "", client: "Cliente Z", projectType: "Foo", startDate: "amanhã",
            endDate: "01/01/2027", pm: "ninguem@amt.pt", modules: "EC, XX" }),
        row({ code: "CO-N-0200", name: "A", client: "Cliente A", projectType: "Rollout", startDate: "01/01/2027", endDate: "01/02/2027" }),
        row({ code: "co-n-0200", name: "B", client: "Cliente A", projectType: "Rollout", startDate: "01/01/2027", endDate: "01/02/2027" })
    ], KNOWN);

    assert.deepEqual(errorsOf(aRows[0]).sort(), [
        "impErrorClient:Cliente Z", "impErrorCodeTaken:CO-N-0001", "impErrorDate:amanhã", "impErrorModule:XX",
        "impErrorPerson:ninguem@amt.pt", "impErrorType:Foo", "pfErrorRequired"
    ]);
    assert.equal(aRows[0].payload, null);
    assert.deepEqual(aRows[1].errors, []);
    assert.deepEqual(errorsOf(aRows[2]), ["impErrorCodeRepeated:co-n-0200"]);
});

test("finds columns by their header, in any order, and skips empty rows", () => {
    const aRows = projectImport.read([
        ["Nome", "codigo", "Tipo de Projeto", "cliente", "data de inicio", "Data de fim"],
        ["Projeto Y", "CO-N-0300", "Assessment", "cliente a", "2027-03-01", "2027-04-01"],
        ["", "", "", "", "", ""]
    ], KNOWN);

    assert.equal(aRows.length, 1);
    assert.deepEqual(aRows[0].errors, []);
    assert.equal(aRows[0].payload.code, "CO-N-0300");
});
