"use strict";

// Audits in the mock /project service, as docs/backend-api-guide.md says
// the API treats them: only on a milestone that requires one (BR-10), a
// suggested code when it is left empty (<project number>_<milestone>_<ddmmyyyy>,
// e.g. 3251_GOP_15062026), a unique code, and addFollowUp creating a
// FollowUp item on the audited milestone. Data comes from Audits.json.

const { randomUUID } = require("node:crypto");

async function milestoneAndProject(base, milestoneID) {
    const milestone = (await (await base.getEntityInterface("Milestones")).fetchEntries({}))
        .find((m) => m.ID === milestoneID);
    const project = milestone && (await (await base.getEntityInterface("Projects")).fetchEntries({}))
        .find((p) => p.ID === milestone.project_ID);

    return { milestone, project };
}

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const { milestone, project } = await milestoneAndProject(this.base, mockEntry.milestone_ID);
        const all = await this.base.fetchEntries({});

        if (!milestone) {
            return this.throwError("milestone_ID is required.", 400);
        }
        if (!milestone.requiresAudit) {
            return this.throwError(`The ${milestone.milestoneType} milestone does not require an audit.`, 400);
        }
        if (!mockEntry.code) {
            const date = mockEntry.date || new Date().toISOString().slice(0, 10);
            const number = project.code.replace(/\D/g, "").replace(/^0+/, "");

            mockEntry.code = number + "_" + milestone.milestoneType.replace(/[^A-Za-z]/g, "") + "_" +
                date.slice(8, 10) + date.slice(5, 7) + date.slice(0, 4);
        }
        if (all.some((a) => a.code === mockEntry.code)) {
            return this.throwError(`An audit with code '${mockEntry.code}' already exists.`, 409);
        }
        return this.base.addEntry(mockEntry, odataRequest);
    },

    executeAction: async function (actionDefinition, actionData, keys) {
        if (actionDefinition.name !== "addFollowUp") {
            return this.throwError("Not mocked: " + actionDefinition.name, 501);
        }
        const audit = (await this.base.fetchEntries(keys))[0];

        if (!actionData.name || !actionData.owner_ID || !actionData.date) {
            return this.throwError("name, owner_ID and date are required.", 400);
        }
        await (await this.base.getEntityInterface("MilestoneItems")).addEntry({
            ID: randomUUID(), milestone_ID: audit.milestone_ID, type: "FollowUp", name: actionData.name,
            description: actionData.description || null, date: actionData.date, owner_ID: actionData.owner_ID,
            status: "ToDo", audit_ID: audit.ID, isOverdue: actionData.date < new Date().toISOString().slice(0, 10)
        });
        return undefined;
    }
};
