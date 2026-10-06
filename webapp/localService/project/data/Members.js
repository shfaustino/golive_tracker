"use strict";

// Team members in the mock /project service. The modules a member works on
// come inside the member, as the API takes them: in the POST (a deep insert)
// and in a PATCH, which replaces the whole list; each must be one of the
// project's modules (400). Data comes from Members.json.

const { randomUUID } = require("node:crypto");
const { replaceChildren } = require("../../../../tools/mock-children");

const setModules = (base, memberID, modules) => replaceChildren(base, "MemberModules", "member_ID", memberID,
    modules.map((m) => ({ module: m.module })), (m) => ({ member_ID: m.member_ID, module: m.module }));

async function unknownModules(base, projectID, modules) {
    const own = (await (await base.getEntityInterface("ProjectModules")).fetchEntries({}))
        .filter((m) => m.project_ID === projectID).map((m) => m.module);

    return modules.map((m) => m.module).filter((m) => !own.includes(m));
}

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const modules = mockEntry.modules || [];
        const unknown = await unknownModules(this.base, mockEntry.project_ID, modules);

        if (unknown.length) {
            return this.throwError(`Not a module of the project: ${unknown.join(", ")}.`, 400);
        }
        delete mockEntry.modules;
        mockEntry.ID = mockEntry.ID || randomUUID();
        await this.base.addEntry(mockEntry, odataRequest);
        await setModules(this.base, mockEntry.ID, modules);
    },

    updateEntry: async function (keyValues, updatedData, patchData, odataRequest) {
        if (Array.isArray(patchData.modules)) {
            const unknown = await unknownModules(this.base, updatedData.project_ID, patchData.modules);

            if (unknown.length) {
                return this.throwError(`Not a module of the project: ${unknown.join(", ")}.`, 400);
            }
            await setModules(this.base, keyValues.ID, patchData.modules);
        }
        delete updatedData.modules;
        return this.base.updateEntry(keyValues, updatedData, patchData, odataRequest);
    }
};
