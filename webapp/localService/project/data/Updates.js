"use strict";

// A posted update in the mock /project service: the API fills in the author
// and the time (docs/backend-api-guide.md, "Updates de estado"). The author
// is the signed-in mock user, the first person in People.json. The update
// also goes to RecentUpdates, the API's view across projects, with the
// project and the author flattened in.

module.exports = {
    addEntry: async function (mockEntry, odataRequest) {
        const people = await (await this.base.getEntityInterface("People")).fetchEntries({});
        const author = people.find((p) => p.ID === mockEntry.author_ID) || people[0];
        const project = (await (await this.base.getEntityInterface("Projects")).fetchEntries({}))
            .find((p) => p.ID === mockEntry.project_ID) || {};

        mockEntry.author_ID = author.ID;
        mockEntry.postedAt = mockEntry.postedAt || new Date().toISOString();
        mockEntry.isAutomatic = mockEntry.isAutomatic === true;
        mockEntry.milestone_ID = mockEntry.milestone_ID || null;
        await this.base.addEntry(mockEntry, odataRequest);
        await (await this.base.getEntityInterface("RecentUpdates")).addEntry({
            ID: mockEntry.ID, project_ID: mockEntry.project_ID, author_ID: author.ID, postedAt: mockEntry.postedAt,
            text: mockEntry.text, isAutomatic: mockEntry.isAutomatic,
            projectCode: project.code, projectName: project.name, authorName: author.name
        });
    }
};
