"use strict";

// A posted update in the mock /project service: the API fills in the author
// and the time (docs/backend-api-guide.md, "Updates de estado"). The author
// is the signed-in mock user, the first person in People.json.

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const author = (await (await this.base.getEntityInterface("People")).fetchEntries({}))[0];

        mockEntry.author_ID = author.ID;
        mockEntry.createdAt = new Date().toISOString();
        mockEntry.isAutomatic = mockEntry.isAutomatic === true;
        mockEntry.milestone_ID = mockEntry.milestone_ID || null;
        return this.base.addEntry(mockEntry, odataRequest);
    }
};
