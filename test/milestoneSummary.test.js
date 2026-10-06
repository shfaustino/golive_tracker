"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const milestoneSummary = require("./loadUi5Module")("model/milestoneSummary.js");

test("summarise counts the statuses and leaves not applicable and cancelled out", () => {
    const oSummary = milestoneSummary.summarise([
        { status: "Completed" },
        { status: "Completed" },
        { status: "InProgress", isOverdue: true },
        { status: "Planned" },
        { status: "NotApplicable" },
        { status: "Cancelled" }
    ]);

    assert.equal(oSummary.total, 4);
    assert.equal(oSummary.completed, 2);
    assert.equal(oSummary.completedPct, 50);
    assert.equal(oSummary.inProgress, 1);
    assert.equal(oSummary.overdue, 1);
    assert.equal(oSummary.notStarted, 1);
    assert.equal(oSummary.notStartedPct, 25);
});

test("summarise of no milestones is all zeros", () => {
    const oSummary = milestoneSummary.summarise([]);

    assert.equal(oSummary.total, 0);
    assert.equal(oSummary.completedPct, 0);
});

const BEFORE = { forecastStart: "2026-10-01", forecastEnd: "2026-10-20", status: "Planned", actualDate: null, justification: null };

test("editChanges sends only what changed", () => {
    const oResult = milestoneSummary.editChanges(BEFORE, Object.assign({}, BEFORE, { status: "InProgress" }));

    assert.deepEqual(oResult.changes, { status: "InProgress" });
    assert.deepEqual(oResult.errors, {});
});

test("editChanges asks for a reason when the forecast dates move", () => {
    const oAfter = Object.assign({}, BEFORE, { forecastEnd: "2026-11-05", changeReason: "  " });

    assert.equal(milestoneSummary.editChanges(BEFORE, oAfter).errors.changeReason, "msErrorChangeReason");

    oAfter.changeReason = " Client asked to postpone ";
    assert.deepEqual(milestoneSummary.editChanges(BEFORE, oAfter), {
        changes: { forecastEnd: "2026-11-05", changeReason: "Client asked to postpone" },
        errors: {}
    });
});

test("editChanges needs an actual date for Completed and a justification for NotApplicable", () => {
    assert.equal(milestoneSummary.editChanges(BEFORE, Object.assign({}, BEFORE, { status: "Completed" })).errors.actualDate,
        "msErrorActualDate");
    assert.equal(milestoneSummary.editChanges(BEFORE, Object.assign({}, BEFORE, { status: "NotApplicable" })).errors.justification,
        "msErrorJustification");
});

test("editChanges refuses an end before the start", () => {
    const oAfter = Object.assign({}, BEFORE, { forecastEnd: "2026-09-01", changeReason: "x" });

    assert.equal(milestoneSummary.editChanges(BEFORE, oAfter).errors.forecastEnd, "msErrorEndBeforeStart");
});
