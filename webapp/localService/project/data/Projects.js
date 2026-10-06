"use strict";

// Bound actions of Projects in the mock /project service (npm run start-mock).
// Data still comes from Projects.json.

const { randomUUID } = require("node:crypto");

function dayBefore(sDate) {
    const oDate = new Date(sDate + "T00:00:00Z");

    oDate.setUTCDate(oDate.getUTCDate() - 1);
    return oDate.toISOString().slice(0, 10);
}

module.exports = {
    executeAction: async function (actionDefinition, actionData, keys) {
        if (actionDefinition.name !== "handOverPM") {
            return this.throwError("Not mocked: " + actionDefinition.name, 501);
        }

        // As the guide says: the current PM's membership ends, the new
        // one's starts, and the project points at the new PM.
        const members = await this.base.getEntityInterface("Members");
        const all = await members.fetchEntries({});
        const project = (await this.base.fetchEntries(keys))[0];
        const current = all.find((m) => m.project_ID === keys.ID && m.role === "PM" && !m.endDate);

        if (!actionData.person_ID || !actionData.startDate) {
            return this.throwError("person_ID and startDate are required.", 400);
        }
        if (current && current.person_ID === actionData.person_ID) {
            return this.throwError("This person already is the project's PM.", 409);
        }
        if (current) {
            await members.updateEntry({ ID: current.ID }, Object.assign({}, current, { endDate: dayBefore(actionData.startDate) }));
        }
        const ID = randomUUID();
        await members.addEntry({
            ID, project_ID: keys.ID, person_ID: actionData.person_ID, role: "PM",
            startDate: actionData.startDate, endDate: null
        });
        await this.base.updateEntry(keys, Object.assign({}, project, { pm_ID: ID, lastUpdateAt: new Date().toISOString() }));
        return undefined;
    }
};
