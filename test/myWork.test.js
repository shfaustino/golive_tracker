"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const myWork = require("./loadUi5Module")("model/myWork.js");

const TODAY = "2026-10-06";
const ITEMS = [
    { ID: "1", name: "Rever documentação", status: "ToDo", date: "2026-10-01", projectCode: "CO-T-0001" },
    { ID: "2", name: "Testes de carga", status: "InProgress", date: "2026-09-26", projectCode: "CO-T-0023" },
    { ID: "3", name: "Formação", status: "Done", date: "2026-09-01", projectCode: "CO-T-0010" },
    { ID: "4", name: "Checklist go-live", status: "ToDo", date: "2026-10-20", projectCode: "CO-T-0020", projectName: "Portal" },
    { ID: "5", name: "Validação", status: "InProgress", date: "2026-10-08", projectCode: "CO-T-0007" },
    { ID: "6", name: "Cancelada", status: "Cancelled", date: "2026-09-01", projectCode: "CO-T-0007" }
];

test("describe counts the KPI row", () => {
    assert.deepEqual(myWork.describe(ITEMS, TODAY).kpi, { total: 6, inProgress: 2, late: 2, done: 1 });
});

test("describe lists late items, most late first, with the days", () => {
    assert.deepEqual(myWork.describe(ITEMS, TODAY).late.map((o) => o.ID + ":" + o.daysLate), ["2:10", "1:5"]);
});

test("describe lists upcoming open items, soonest first", () => {
    assert.deepEqual(myWork.describe(ITEMS, TODAY).upcoming.map((o) => o.ID), ["5", "4"]);
});

test("describe trusts the API's isOverdue when it sends one", () => {
    const o = myWork.describe([{ ID: "x", status: "ToDo", date: "2026-01-01", isOverdue: false }], TODAY);

    assert.equal(o.kpi.late, 0);
});

test("filter by text over task, project code and project name", () => {
    const aItems = myWork.describe(ITEMS, TODAY).items;

    assert.deepEqual(myWork.filter(aItems, "carga", "").map((o) => o.ID), ["2"]);
    assert.deepEqual(myWork.filter(aItems, "co-t-0007", "").map((o) => o.ID), ["5", "6"]);
    assert.deepEqual(myWork.filter(aItems, "portal", "").map((o) => o.ID), ["4"]);
});

test("filter by state: Late is a state of its own, and late items leave their status", () => {
    const aItems = myWork.describe(ITEMS, TODAY).items;

    assert.deepEqual(myWork.filter(aItems, "", "Late").map((o) => o.ID), ["1", "2"]);
    assert.deepEqual(myWork.filter(aItems, "", "InProgress").map((o) => o.ID), ["5"]);
});
