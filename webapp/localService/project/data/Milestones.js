"use strict";

// Milestones in the mock /project service. Their owners come inside the
// milestone, as the API takes them: in the POST (a deep insert) and in a
// PATCH, which replaces the whole list. Data comes from Milestones.json.

const { randomUUID } = require("node:crypto");
const { replaceChildren } = require("../../../../tools/mock-children");

const setOwners = (base, milestoneID, owners) => replaceChildren(base, "MilestoneOwners", "milestone_ID", milestoneID,
    owners.map((o) => ({ ID: randomUUID(), person_ID: o.person_ID })), (o) => ({ ID: o.ID }));

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const owners = mockEntry.owners || [];
        const siblings = (await (await this.base.getEntityInterface("Milestones")).fetchEntries({}))
            .filter((m) => m.project_ID === mockEntry.project_ID);

        delete mockEntry.owners;
        Object.assign(mockEntry, {
            ID: mockEntry.ID || randomUUID(),
            module: mockEntry.module || null,
            status: mockEntry.status || "Planned",
            sortOrder: Math.max(0, ...siblings.map((m) => m.sortOrder || 0)) + 1,
            mandatory: false, requiresAudit: false, isEstimated: !!mockEntry.isEstimated, isOverdue: false, itemsCompletion: null
        });
        await this.base.addEntry(mockEntry, odataRequest);
        await setOwners(this.base, mockEntry.ID, owners);
    },

    updateEntry: async function (keyValues, updatedData, patchData, odataRequest) {
        if (Array.isArray(patchData.owners)) {
            await setOwners(this.base, keyValues.ID, patchData.owners);
        }
        delete updatedData.owners;
        return this.base.updateEntry(keyValues, updatedData, patchData, odataRequest);
    }
};
