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
    assert.equal(moduleBreakdown.count(moduleBreakdown.WHOLE_PROJECT, [{ module: "EC" }, { module: null }, {}]), 2);
});

test("describe of the whole project: the milestones and members of no module", () => {
    const [oWhole] = moduleBreakdown.describe([{ module: moduleBreakdown.WHOLE_PROJECT }], MILESTONES, TEAM);

    assert.deepEqual(oWhole.milestones.map((m) => m.milestoneType), ["KO"]);
    assert.equal(oWhole.msDone, 1);
    assert.deepEqual(oWhole.team.map((m) => m.name), ["Paula"]);
});

test("milestonesOf a module, and of the whole project (no module)", () => {
    assert.deepEqual(moduleBreakdown.milestonesOf("EC", MILESTONES).map((m) => m.ID), ["2", "3", "4"]);
    assert.deepEqual(moduleBreakdown.milestonesOf(moduleBreakdown.WHOLE_PROJECT, MILESTONES).map((m) => m.ID), ["1"]);
    assert.deepEqual(moduleBreakdown.milestonesOf("FI", MILESTONES), []);
});

test("membersOf a module, and of the whole project (members with no module)", () => {
    assert.deepEqual(moduleBreakdown.membersOf("LMS", TEAM).map((m) => m.person.name), ["Rui", "Ana"]);
    assert.deepEqual(moduleBreakdown.membersOf(moduleBreakdown.WHOLE_PROJECT, TEAM).map((m) => m.person.name), ["Paula"]);
});

test("isOfModule matches a row through its milestone's module", () => {
    assert.equal(moduleBreakdown.isOfModule("EC", "EC"), true);
    assert.equal(moduleBreakdown.isOfModule("EC", "LMS"), false);
    assert.equal(moduleBreakdown.isOfModule("EC", null), false);
    assert.equal(moduleBreakdown.isOfModule(moduleBreakdown.WHOLE_PROJECT, null), true);
    assert.equal(moduleBreakdown.isOfModule(moduleBreakdown.WHOLE_PROJECT, undefined), true);
    assert.equal(moduleBreakdown.isOfModule(moduleBreakdown.WHOLE_PROJECT, "EC"), false);
});
