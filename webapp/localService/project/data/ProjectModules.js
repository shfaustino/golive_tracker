"use strict";

// A project's modules in the mock /project service: keyed by project and
// module, so the same module twice is refused, as the API does (409).
// Data comes from ProjectModules.json.

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const existing = await (await this.base.getEntityInterface("ProjectModules")).fetchEntries({});

        if (existing.some((m) => m.project_ID === mockEntry.project_ID && m.module === mockEntry.module)) {
            return this.throwError("A record with the same value already exists.", 409);
        }
        return this.base.addEntry(mockEntry, odataRequest);
    }
};
