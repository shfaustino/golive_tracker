"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const auditRows = require("./loadUi5Module")("model/auditRows.js");

test("flatten puts the milestone, the project, the auditor and the follow-ups on one row", () => {
    const oRow = auditRows.flatten({
        ID: "a1", milestone_ID: "m1", code: "3251_GOP_15062026", date: "2026-06-15", auditor_ID: "p1", result: "Rejected",
        notes: null, auditor: { name: "Ana Silva" },
        milestone: {
            ID: "m1", milestoneType: "GOP", module: "EC", project_ID: "pr1",
            project: { ID: "pr1", code: "CO-N-03251", name: "Projeto" }
        },
        followUps: [{ ID: "f1", status: "ToDo" }, { ID: "f2", status: "Done" }]
    });

    assert.deepEqual(oRow, {
        ID: "a1", milestone_ID: "m1", code: "3251_GOP_15062026", date: "2026-06-15", auditor_ID: "p1", auditorName: "Ana Silva",
        result: "Rejected", notes: null, milestoneType: "GOP", module: "EC", project_ID: "pr1", projectCode: "CO-N-03251",
        projectName: "Projeto", fuTotal: 2, fuOpen: 1
    });
});

test("flatten copes with a missing auditor and no follow-ups", () => {
    const oRow = auditRows.flatten({ ID: "a1", milestone: { project_ID: "pr1" } });

    assert.equal(oRow.auditorName, "");
    assert.equal(oRow.fuTotal, 0);
    assert.equal(oRow.project_ID, "pr1");
});
