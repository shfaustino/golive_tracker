"use strict";

// Bound actions of Projects in the mock /project service (npm run start-mock):
// handOverPM, changeStatus and setBaseline, as docs/backend-api-guide.md
// describes them. Data still comes from Projects.json.

const { randomUUID } = require("node:crypto");

const CLOSED_MILESTONE = ["Completed", "NotApplicable", "Cancelled"];

function dayBefore(sDate) {
    const oDate = new Date(sDate + "T00:00:00Z");

    oDate.setUTCDate(oDate.getUTCDate() - 1);
    return oDate.toISOString().slice(0, 10);
}

async function people(base) {
    return (await base.getEntityInterface("People")).fetchEntries({});
}

// "Cada mudança de estado publica um update automático no projeto."
async function publishUpdate(base, projectID, text) {
    const author = (await people(base))[0];

    await (await base.getEntityInterface("Updates")).addEntry({
        ID: randomUUID(), project_ID: projectID, text, milestone_ID: null, isAutomatic: true,
        author_ID: author.ID, createdAt: new Date().toISOString()
    });
}

const actions = {
    async handOverPM(data, keys, project) {
        const members = await this.base.getEntityInterface("Members");
        const all = await members.fetchEntries({});
        const current = all.find((m) => m.project_ID === keys.ID && m.role === "PM" && !m.endDate);

        if (!data.person_ID || !data.startDate) {
            return this.throwError("person_ID and startDate are required.", 400);
        }
        if (current && current.person_ID === data.person_ID) {
            return this.throwError("This person already is the project's PM.", 409);
        }
        if (current) {
            await members.updateEntry({ ID: current.ID }, Object.assign({}, current, { endDate: dayBefore(data.startDate) }));
        }
        const ID = randomUUID();
        await members.addEntry({ ID, project_ID: keys.ID, person_ID: data.person_ID, role: "PM", startDate: data.startDate, endDate: null });
        await this.base.updateEntry(keys, Object.assign({}, project, { pm_ID: ID, lastUpdateAt: new Date().toISOString() }));
        return undefined;
    },

    async changeStatus(data, keys, project) {
        if (!data.status) {
            return this.throwError("status is required.", 400);
        }
        if (data.status === project.status) {
            return this.throwError(`The project already is ${data.status}.`, 409);
        }
        if (data.status === "Closing") {
            const milestones = (await (await this.base.getEntityInterface("Milestones")).fetchEntries({}))
                .filter((m) => m.project_ID === keys.ID && !CLOSED_MILESTONE.includes(m.status));
            if (milestones.length) {
                return this.throwError("Cannot move to Closing: milestones still open: " +
                    milestones.map((m) => m.milestoneType).join(", ") + ".", 409);
            }
        }
        // read before the update: the mock store changes the entry in place
        const previous = project.status;

        await this.base.updateEntry(keys, Object.assign({}, project, { status: data.status, lastUpdateAt: new Date().toISOString() }));
        await publishUpdate(this.base, keys.ID, `Status changed from ${previous} to ${data.status}` +
            (data.reason ? `: ${data.reason}` : "."));
        return undefined;
    },

    async setBaseline(data, keys) {
        const milestones = await this.base.getEntityInterface("Milestones");
        const own = (await milestones.fetchEntries({})).filter((m) => m.project_ID === keys.ID);

        for (const m of own) {
            await milestones.updateEntry({ ID: m.ID }, Object.assign({}, m, { baselineStart: m.forecastStart, baselineEnd: m.forecastEnd }));
        }
        await publishUpdate(this.base, keys.ID, "Baseline saved" + (data.reason ? `: ${data.reason}` : "."));
        return undefined;
    }
};

// The milestones each project type brings (docs/backend-api-guide.md,
// "Criar e editar"); the same table as webapp/model/projectForm.js.
const TEMPLATES = {
    "Implementation": ["KO", "PTO", "GOP", "Training", "Testing", "Go-live", "Closure"],
    "Rollout": ["KO", "GOP", "Testing", "Go-live", "Closure"],
    "Integration": ["KO", "PTO", "Testing", "Go-live", "Closure"],
    "Enhancements/CR": ["KO", "Testing", "Go-live", "Closure"],
    "Assessment": ["KO", "Report delivery", "Closure"],
    "Change management": ["KO", "Training", "Closure"]
};

module.exports = {
    /**
     * POST /Projects as the API does it: the code is unique (409), the
     * modules and the team go to their own sets, the creator joins (as PM
     * when none is named, as PMO otherwise), the milestones come from the
     * type, and the project starts NotStarted.
     */
    addEntry: async function (mockEntry, odataRequest) {
        const all = await this.base.fetchEntries({});
        const me = (await people(this.base))[0];
        const members = (mockEntry.members || []).map((m) => Object.assign({ ID: randomUUID(), endDate: null }, m));
        const modules = mockEntry.modules || [];

        if (all.some((p) => p.code === mockEntry.code)) {
            return this.throwError(`A project with code '${mockEntry.code}' already exists.`, 409, {
                error: { code: "409", message: `A project with code '${mockEntry.code}' already exists.`, target: "code" }
            });
        }
        if (mockEntry.endDate < mockEntry.startDate) {
            return this.throwError("endDate must be on or after startDate.", 400);
        }
        if (!members.some((m) => m.person_ID === me.ID)) {
            members.push({
                ID: randomUUID(), person_ID: me.ID, endDate: null, startDate: mockEntry.startDate,
                role: members.some((m) => m.role === "PM") ? "PMO" : "PM"
            });
        }
        delete mockEntry.members;
        delete mockEntry.modules;
        const pm = members.find((m) => m.role === "PM");
        Object.assign(mockEntry, {
            status: "NotStarted", needsReview: false, reviewReason: null, pm_ID: pm ? pm.ID : null,
            externalCode: mockEntry.externalCode || null, lastUpdateAt: new Date().toISOString()
        });
        await this.base.addEntry(mockEntry, odataRequest);

        const memberSet = await this.base.getEntityInterface("Members");
        for (const m of members) {
            await memberSet.addEntry(Object.assign({ project_ID: mockEntry.ID }, m));
        }
        const moduleSet = await this.base.getEntityInterface("ProjectModules");
        for (const m of modules) {
            await moduleSet.addEntry({ ID: randomUUID(), project_ID: mockEntry.ID, module: m.module });
        }
        const milestoneSet = await this.base.getEntityInterface("Milestones");
        const types = TEMPLATES[mockEntry.projectType] || [];
        for (let i = 0; i < types.length; i += 1) {
            await milestoneSet.addEntry({
                ID: randomUUID(), project_ID: mockEntry.ID, milestoneType: types[i], sortOrder: i + 1, mandatory: true,
                status: "Planned", forecastStart: null, forecastEnd: null, baselineStart: null, baselineEnd: null,
                actualDate: null, isEstimated: true, isOverdue: false, itemsCompletion: 0, justification: null, changeReason: null
            });
        }
        return undefined;
    },

    executeAction: async function (actionDefinition, actionData, keys) {
        const action = actions[actionDefinition.name];

        if (!action) {
            return this.throwError("Not mocked: " + actionDefinition.name, 501);
        }
        const project = (await this.base.fetchEntries(keys))[0];

        return action.call(this, actionData || {}, keys, project);
    }
};
