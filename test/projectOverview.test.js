"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const projectOverview = require("./loadUi5Module")("model/projectOverview.js");

const MILESTONES = [
    { ID: "1", milestoneType: "KO", status: "Completed", forecastEnd: "2026-03-01", actualDate: "2026-03-02" },
    { ID: "2", milestoneType: "PTO", status: "InProgress", forecastEnd: "2026-09-01", isOverdue: true },
    { ID: "3", milestoneType: "GOP", status: "NotApplicable", forecastEnd: "2026-10-01" },
    { ID: "4", milestoneType: "Testing", status: "Planned", forecastEnd: "2026-11-05" },
    { ID: "5", milestoneType: "Closure", status: "Planned", forecastEnd: "2027-01-10" }
];

test("describe counts progress without the milestones that do not apply", () => {
    const o = projectOverview.describe(MILESTONES, "2026-10-06");

    assert.equal(o.total, 4);
    assert.equal(o.done, 1);
    assert.equal(o.pct, 25);
});

test("describe marks the steps: done, late, then the first open one current", () => {
    const o = projectOverview.describe(MILESTONES, "2026-10-06");

    assert.deepEqual(o.steps.map((s) => s.milestoneType + ":" + s.step), ["KO:done", "PTO:late", "Testing:current", "Closure:todo"]);
    assert.equal(o.steps[0].date, "2026-03-02");
});

test("describe's next milestone is the first one not done, late or not", () => {
    const o = projectOverview.describe(MILESTONES, "2026-10-06");

    assert.deepEqual(o.next, { ID: "2", milestoneType: "PTO", date: "2026-09-01", days: -35, overdue: true });
});

test("describe of a project with everything done has no next milestone", () => {
    const o = projectOverview.describe([MILESTONES[0]], "2026-10-06");

    assert.equal(o.pct, 100);
    assert.equal(o.next, null);
});

test("describe of no milestones", () => {
    const o = projectOverview.describe([], "2026-10-06");

    assert.equal(o.total, 0);
    assert.equal(o.pct, 0);
    assert.deepEqual(o.steps, []);
});
