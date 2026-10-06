"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const memberRules = require("./loadUi5Module")("model/memberRules.js");

const NOW = new Date(2026, 9, 6);

test("isActive: no end date, or one not passed yet", () => {
    assert.equal(memberRules.isActive(null, NOW), true);
    assert.equal(memberRules.isActive("2026-10-06", NOW), true);
    assert.equal(memberRules.isActive("2026-12-31", NOW), true);
    assert.equal(memberRules.isActive("2026-10-05", NOW), false);
});

test("assignableRoles leaves PM out, unless the member already is the PM", () => {
    assert.equal(memberRules.assignableRoles().includes("PM"), false);
    assert.equal(memberRules.assignableRoles("Architect").includes("PM"), false);
    assert.equal(memberRules.assignableRoles("PM").includes("PM"), true);
});

test("validate a new member needs a person, a role and a start", () => {
    assert.deepEqual(memberRules.validate({ mode: "add" }), {
        person_ID: "memberErrorPerson", role: "memberErrorRole", startDate: "memberErrorStart"
    });
    assert.deepEqual(memberRules.validate({ mode: "add", person_ID: "p", role: "PMO", startDate: "2026-10-01" }), {});
});

test("validate refuses an end before the start", () => {
    assert.deepEqual(memberRules.validate({ mode: "edit", role: "PMO", startDate: "2026-10-01", endDate: "2026-09-30" }),
        { endDate: "memberErrorEndBeforeStart" });
});

test("validate a handover needs only the new PM and the start", () => {
    assert.deepEqual(memberRules.validate({ mode: "handover" }), {
        person_ID: "memberErrorPerson", startDate: "memberErrorStart"
    });
    assert.deepEqual(memberRules.validate({ mode: "handover", person_ID: "p", startDate: "2026-10-06" }), {});
});

test("today is YYYY-MM-DD", () => {
    assert.equal(memberRules.today(NOW), "2026-10-06");
});
