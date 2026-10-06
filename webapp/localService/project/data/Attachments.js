"use strict";

// Attachments in the mock /project service, as golive-tracker-api treats them
// (srv/handlers/attachments.js): a link (http or https) on exactly one owner,
// a document type (the column is NOT NULL), and the author filled in. Every
// change is mirrored into AllAttachments, the API's view with the project,
// milestone and item flattened in. Data comes from Attachments.json.

const { randomUUID } = require("node:crypto");

const LINK = /^https?:\/\/\S+$/i;

async function all(base, set) {
    return (await base.getEntityInterface(set)).fetchEntries({});
}

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const owners = ["project_ID", "milestone_ID", "milestoneItem_ID"].filter((key) => mockEntry[key]);

        if (owners.length !== 1) {
            return this.throwError("An attachment belongs to exactly one project, milestone or milestone item (BR-11).", 400);
        }
        if (!LINK.test(mockEntry.url || "")) {
            return this.throwError("The attachment must be an http(s) link, e.g. a SharePoint URL.", 400);
        }
        if (!mockEntry.documentType) {
            return this.throwError("NOT NULL constraint failed: amt_golive_Attachments.documentType", 400);
        }
        const me = (await all(this.base, "People"))[0];
        const items = await all(this.base, "MilestoneItems");
        const milestones = await all(this.base, "Milestones");
        const projects = await all(this.base, "Projects");
        const item = mockEntry.milestoneItem_ID && items.find((i) => i.ID === mockEntry.milestoneItem_ID);
        const milestone = milestones.find((m) => m.ID === (mockEntry.milestone_ID || (item && item.milestone_ID)));
        const project = projects.find((p) => p.ID === (mockEntry.project_ID || (milestone && milestone.project_ID)));

        Object.assign(mockEntry, {
            ID: mockEntry.ID || randomUUID(), author_ID: me.ID, createdAt: new Date().toISOString(),
            project_ID: mockEntry.project_ID || null, milestone_ID: mockEntry.milestone_ID || null,
            milestoneItem_ID: mockEntry.milestoneItem_ID || null
        });
        await this.base.addEntry(mockEntry, odataRequest);
        await (await this.base.getEntityInterface("AllAttachments")).addEntry(Object.assign({}, mockEntry, {
            projectID: project ? project.ID : null, projectCode: project ? project.code : null, projectName: project ? project.name : null,
            milestoneType: milestone ? milestone.milestoneType : null, module: null, itemName: item ? item.name : null
        }));
    },

    removeEntry: async function (keyValues, odataRequest) {
        await this.base.removeEntry(keyValues, odataRequest);
        await (await this.base.getEntityInterface("AllAttachments")).removeEntry(keyValues);
    }
};
