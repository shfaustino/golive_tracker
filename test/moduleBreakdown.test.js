"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const moduleBreakdown = require("./loadUi5Module")("model/moduleBreakdown.js");

const MILESTONES = [
    { ID: "1", milestoneType: "KO", module: null, status: "Completed" },
    { ID: "2", milestoneType: "GOP", module: "EC", status: "Completed" },
    { ID: "3", milestoneType: "Training", module: "EC", status: "Planned" },
    { ID: "4", milestoneType: "Testing", module: "EC", status: "NotApplicable" },
    { ID: "5", milestoneType: "GOP", module: "LMS", status: "InProgress" }
];
const TEAM = [
    { person: { name: "Paula" }, role: "PM", modules: [] },
    { person: { name: "Rui" }, role: "Functional lead", modules: [{ module: "EC" }, { module: "LMS" }] },
    { person: { name: "Ana" }, role: "Testing owner", modules: [{ module: "LMS" }] }
];

test("describe gives each module its milestones and progress, leaving out not applicable", () => {
    const [oEc, oLms] = moduleBreakdown.describe([{ module: "EC" }, { module: "LMS" }], MILESTONES, TEAM);

    assert.deepEqual(oEc.milestones.map((m) => m.milestoneType), ["GOP", "Training", "Testing"]);
    assert.equal(oEc.msTotal, 2);
    assert.equal(oEc.msDone, 1);
    assert.equal(oLms.msTotal, 1);
    assert.equal(oLms.msDone, 0);
});

test("describe gives each module the members who work on it, not the whole-project ones", () => {
    const [oEc, oLms] = moduleBreakdown.describe([{ module: "EC" }, { module: "LMS" }], MILESTONES, TEAM);

    assert.deepEqual(oEc.team.map((m) => m.name), ["Rui"]);
    assert.deepEqual(oLms.team.map((m) => m.name), ["Rui", "Ana"]);
});

test("describe of a module with nothing yet", () => {
    assert.deepEqual(moduleBreakdown.describe([{ module: "FI" }], MILESTONES, TEAM),
        [{ module: "FI", milestones: [], msTotal: 0, msDone: 0, team: [] }]);
});

test("count counts the rows of a module", () => {
    assert.equal(moduleBreakdown.count("EC", [{ module: "EC" }, { module: null }, { module: "EC" }]), 2);
    assert.equal(moduleBreakdown.count("EC", null), 0);
});
