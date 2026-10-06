"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const attachmentRules = require("./loadUi5Module")("model/attachmentRules.js");

const BASE = { name: "Plano", url: "https://amt.sharepoint.com/plano.pdf", project_ID: "p1", owner: "project", documentType: "Test plan" };

test("validate needs a name, an http(s) link, a document type and the owner", () => {
    assert.deepEqual(attachmentRules.validate(BASE), {});
    assert.equal(attachmentRules.validate(Object.assign({}, BASE, { url: "ftp://x/y" })).url, "attErrorLink");
    assert.equal(attachmentRules.validate(Object.assign({}, BASE, { url: "sharepoint/plano.pdf" })).url, "attErrorLink");
    assert.deepEqual(Object.keys(attachmentRules.validate({ owner: "item" })).sort(),
        ["documentType", "milestoneItem_ID", "milestone_ID", "name", "project_ID", "url"]);
});

test("collectionPath puts the attachment under its one owner", () => {
    assert.equal(attachmentRules.collectionPath(BASE), "/Projects(p1)/attachments");
    assert.equal(attachmentRules.collectionPath(Object.assign({}, BASE, { owner: "milestone", milestone_ID: "m1" })),
        "/Projects(p1)/milestones(m1)/attachments");
    assert.equal(attachmentRules.collectionPath(Object.assign({}, BASE, { owner: "item", milestone_ID: "m1", milestoneItem_ID: "i1" })),
        "/Projects(p1)/milestones(m1)/items(i1)/attachments");
});

test("entityPath finds an existing attachment under its owner", () => {
    assert.equal(attachmentRules.entityPath({ ID: "a1", projectID: "p1" }), "/Projects(p1)/attachments(a1)");
    assert.equal(attachmentRules.entityPath({ ID: "a1", projectID: "p1", milestone_ID: "m1" }), "/Projects(p1)/milestones(m1)/attachments(a1)");
    assert.equal(attachmentRules.entityPath({ ID: "a1", projectID: "p1", milestoneItem_ID: "i1", itemMilestone_ID: "m1" }),
        "/Projects(p1)/milestones(m1)/items(i1)/attachments(a1)");
});

test("body trims, and leaves the document type out when none is picked", () => {
    assert.deepEqual(attachmentRules.body({ name: " Plano ", url: " https://x/y ", documentType: "" }), { name: "Plano", url: "https://x/y" });
    assert.deepEqual(attachmentRules.body({ name: "P", url: "https://x", documentType: "Test plan" }),
        { name: "P", url: "https://x", documentType: "Test plan" });
});

test("flatten names the owner and pulls up the item's milestone", () => {
    const oRow = attachmentRules.flatten({ ID: "a1", milestoneItem_ID: "i1", milestoneItem: { milestone_ID: "m1" }, author: { name: "Ana" } });

    assert.equal(oRow.owner, "item");
    assert.equal(oRow.itemMilestone_ID, "m1");
    assert.equal(oRow.authorName, "Ana");
});
