"use strict";

// Clients in the mock /admin service, with the API's rules
// (golive-tracker-api, srv/admin-service.js): name and tax ID are unique
// (409), and a client with projects is deactivated, never deleted (409).
// Data comes from Clients.json; the projects live in the /project mock, so
// the first eight clients (those the projects use) stand in for "has projects".

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        await this.checkUnique(mockEntry);
        mockEntry.active = mockEntry.active !== false;
        return this.base.addEntry(mockEntry, odataRequest);
    },

    updateEntry: async function (keyValues, updatedData, patchData, odataRequest) {
        await this.checkUnique(Object.assign({}, updatedData, keyValues));
        return this.base.updateEntry(keyValues, updatedData, patchData, odataRequest);
    },

    removeEntry: async function (keyValues, odataRequest) {
        const index = (await this.base.fetchEntries({})).findIndex((c) => c.ID === keyValues.ID);

        if (index > -1 && index < 8) {
            return this.throwError("The client has projects; deactivate it instead of deleting it.", 409);
        }
        return this.base.removeEntry(keyValues, odataRequest);
    },

    checkUnique: async function (entry) {
        const all = await this.base.fetchEntries({});

        for (const field of ["name", "taxId"]) {
            if (entry[field] && all.some((c) => c[field] === entry[field] && c.ID !== entry.ID)) {
                this.throwError(`A client with ${field} '${entry[field]}' already exists.`, 409, {
                    error: { code: "409", message: `A client with ${field} '${entry[field]}' already exists.`, target: field }
                });
            }
        }
    }
};
