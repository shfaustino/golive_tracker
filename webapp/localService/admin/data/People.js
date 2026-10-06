"use strict";

// People in the mock /admin service, with the API's rules
// (golive-tracker-api, srv/admin-service.js): emails are stored in lower
// case and unique (409), and a person with project history is deactivated,
// never deleted (409). Data comes from People.json.

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        await this.checkEmail(mockEntry);
        mockEntry.profile = mockEntry.profile || "User";
        mockEntry.active = mockEntry.active !== false;
        return this.base.addEntry(mockEntry, odataRequest);
    },

    updateEntry: async function (keyValues, updatedData, patchData, odataRequest) {
        await this.checkEmail(Object.assign({}, updatedData, keyValues));
        return this.base.updateEntry(keyValues, updatedData, patchData, odataRequest);
    },

    removeEntry: async function (keyValues, odataRequest) {
        // The mock has no project history of its own here: the first eight
        // people stand in for those who have one.
        const index = (await this.base.fetchEntries({})).findIndex((p) => p.ID === keyValues.ID);

        if (index > -1 && index < 8) {
            return this.throwError("The person has project history; deactivate them instead of deleting them.", 409);
        }
        return this.base.removeEntry(keyValues, odataRequest);
    },

    checkEmail: async function (entry) {
        if (!entry.email) {
            return;
        }
        entry.email = entry.email.trim().toLowerCase();
        const all = await this.base.fetchEntries({});

        if (all.some((p) => p.email === entry.email && p.ID !== entry.ID)) {
            this.throwError(`A person with email '${entry.email}' already exists.`, 409, {
                error: { code: "409", message: `A person with email '${entry.email}' already exists.`, target: "email" }
            });
        }
    }
};
