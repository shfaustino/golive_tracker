"use strict";

// A project's modules in the mock /project service: keyed by project and
// module, so the same module twice is refused, as the API does (409); one
// taken off the project is taken off its team members too, as in the API.
// Data comes from ProjectModules.json.

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const existing = await (await this.base.getEntityInterface("ProjectModules")).fetchEntries({});

        if (existing.some((m) => m.project_ID === mockEntry.project_ID && m.module === mockEntry.module)) {
            return this.throwError("A record with the same value already exists.", 409);
        }
        return this.base.addEntry(mockEntry, odataRequest);
    },

    removeEntry: async function (keyValues, odataRequest) {
        const memberIDs = (await (await this.base.getEntityInterface("Members")).fetchEntries({}))
            .filter((m) => m.project_ID === keyValues.project_ID).map((m) => m.ID);
        const memberModules = await this.base.getEntityInterface("MemberModules");

        await this.base.removeEntry(keyValues, odataRequest);
        for (const m of (await memberModules.fetchEntries({}))
            .filter((x) => x.module === keyValues.module && memberIDs.includes(x.member_ID))) {
            await memberModules.removeEntry({ member_ID: m.member_ID, module: m.module });
        }
    }
};
