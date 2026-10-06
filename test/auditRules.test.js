"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const auditRules = require("./loadUi5Module")("model/auditRules.js");

test("validate needs the milestone, the date, the auditor and the result, not the code", () => {
    assert.deepEqual(Object.keys(auditRules.validate({})).sort(), ["auditor_ID", "date", "milestone_ID", "result"]);
    assert.deepEqual(auditRules.validate({ milestone_ID: "m", date: "2026-10-06", auditor_ID: "a", result: "Approved", code: "" }), {});
});

test("validateFollowUp needs a name, an owner and a date", () => {
    assert.deepEqual(Object.keys(auditRules.validateFollowUp({ name: "  " })).sort(), ["date", "name", "owner_ID"]);
    assert.deepEqual(auditRules.validateFollowUp({ name: "Rever", owner_ID: "p", date: "2026-10-20" }), {});
});

test("followUps counts the open ones (to do or in progress)", () => {
    assert.deepEqual(auditRules.followUps([{ status: "Done" }, { status: "ToDo" }, { status: "InProgress" }, { status: "Cancelled" }]),
        { total: 4, open: 2 });
    assert.deepEqual(auditRules.followUps(null), { total: 0, open: 0 });
});

test("changes sends only what changed", () => {
    const oBefore = { code: "1_GOP_01012026", date: "2026-01-01", auditor_ID: "a", result: "Approved", notes: null };

    assert.deepEqual(auditRules.changes(oBefore, Object.assign({}, oBefore, { result: "Rejected", notes: "" })), { result: "Rejected" });
});

test("Por iniciar is no result in the API, both ways", () => {
    assert.equal(auditRules.toApi("NotStarted"), null);
    assert.equal(auditRules.toApi("Approved"), "Approved");
    assert.equal(auditRules.fromApi(null), "NotStarted");
    assert.equal(auditRules.fromApi("Rejected"), "Rejected");
});

test("changes compares Por iniciar with the API's null", () => {
    const oBefore = { code: "1_GOP_01012026", date: "2026-01-01", auditor_ID: "a", result: null, notes: null };

    assert.deepEqual(auditRules.changes(oBefore, Object.assign({}, oBefore, { result: "NotStarted" })), {});
    assert.deepEqual(auditRules.changes(oBefore, Object.assign({}, oBefore, { result: "Approved" })), { result: "Approved" });
    assert.deepEqual(auditRules.changes({ result: "Approved" }, { result: "NotStarted" }), { result: null });
});
