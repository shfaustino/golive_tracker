"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const projectForm = require("./loadUi5Module")("model/projectForm.js");

const VALID = {
    code: " CO-N-04000 ", name: "New project", client_ID: "c1", projectType: "Implementation",
    startDate: "2026-10-01", endDate: "2027-03-31", value: "25000", currency_code: "EUR",
    externalCode: "", modules: ["EC", "LMS"],
    members: [{ person_ID: "p1", role: "PM", startDate: "" }, { person_ID: "p2", role: "PMO", startDate: "2026-11-01" }]
};

test("milestonesFor gives the type's template, audits marked", () => {
    assert.deepEqual(projectForm.milestonesFor("Rollout").map((m) => m.milestoneType + (m.audit ? "*" : "")),
        ["KO", "GOP", "Testing*", "Go-live*", "Closure"]);
    assert.deepEqual(projectForm.milestonesFor("Hours bank"), []);
    assert.deepEqual(projectForm.milestonesFor("nope"), []);
});

test("validate accepts a complete form", () => {
    assert.deepEqual(projectForm.validate(VALID), { fields: {}, members: {} });
});

test("validate asks for every required field", () => {
    const oResult = projectForm.validate({ members: [] });

    assert.deepEqual(Object.keys(oResult.fields).sort(),
        ["client_ID", "code", "currency_code", "endDate", "name", "projectType", "startDate"]);
});

test("validate refuses an end before the start and a negative value", () => {
    const oResult = projectForm.validate(Object.assign({}, VALID, { endDate: "2026-09-01", value: "-5" }));

    assert.equal(oResult.fields.endDate, "pfErrorEndBeforeStart");
    assert.equal(oResult.fields.value, "pfErrorValue");
});

test("validate flags incomplete, repeated and second-PM team rows", () => {
    const oResult = projectForm.validate(Object.assign({}, VALID, {
        members: [
            { person_ID: "p1", role: "PM" },
            { person_ID: "p1", role: "PM" },
            { person_ID: "p2", role: "PM" },
            { person_ID: "", role: "PMO" }
        ]
    }));

    assert.deepEqual(oResult.members, { 1: "pfErrorDuplicate", 2: "pfErrorTwoPms", 3: "pfErrorMember" });
});

test("payload is the guide's deep insert, without empty optional fields", () => {
    assert.deepEqual(projectForm.payload(VALID), {
        code: "CO-N-04000", name: "New project", client_ID: "c1", projectType: "Implementation",
        startDate: "2026-10-01", endDate: "2027-03-31", currency_code: "EUR", value: 25000,
        modules: [{ module: "EC" }, { module: "LMS" }],
        members: [{ person_ID: "p1", role: "PM", startDate: "2026-10-01" }, { person_ID: "p2", role: "PMO", startDate: "2026-11-01" }]
    });
    assert.equal("value" in projectForm.payload(Object.assign({}, VALID, { value: "" })), false);
});
