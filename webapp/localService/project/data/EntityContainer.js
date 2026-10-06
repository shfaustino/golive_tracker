"use strict";

// The unbound functions of the mock /project service (npm run start-mock):
// me() answers as the first person in People.json, an Administrator, and
// dashboard() is worked out from the mock data the way the guide describes
// (docs/backend-api-guide.md, "O meu trabalho, dashboard e administração").

const OPEN_MILESTONE = ["Planned", "InProgress", "Postponed"];

module.exports = {
    executeAction: async function (actionDefinition, actionData) {
        const people = await (await this.base.getEntityInterface("People")).fetchEntries({});

        if (actionDefinition.name === "me") {
            const me = people[0];

            return { ID: me.ID, name: me.name, email: me.email, profile: me.profile };
        }

        if (actionDefinition.name === "dashboard") {
            const staleDays = (actionData && actionData.staleDays) || 30;
            const projects = await (await this.base.getEntityInterface("Projects")).fetchEntries({});
            const milestones = await (await this.base.getEntityInterface("Milestones")).fetchEntries({});
            const clients = await (await this.base.getEntityInterface("Clients")).fetchEntries({});
            const byId = new Map(projects.map((p) => [p.ID, p]));
            const clientName = (p) => (clients.find((c) => c.ID === p.client_ID) || {}).name || null;
            const ref = (p) => ({
                projectID: p.ID, projectCode: p.code, projectName: p.name, clientName: clientName(p),
                status: p.status, reviewReason: p.reviewReason, lastUpdateAt: p.lastUpdateAt
            });
            const counts = {};
            const staleLimit = Date.now() - staleDays * 86400000;

            projects.forEach((p) => {
                counts[p.status] = (counts[p.status] || 0) + 1;
            });

            return {
                staleDays,
                projectsByStatus: Object.keys(counts).map((status) => ({ status, count: counts[status] })),
                overdueMilestones: milestones
                    .filter((m) => m.isOverdue && OPEN_MILESTONE.includes(m.status))
                    .map((m) => {
                        const p = byId.get(m.project_ID);

                        return {
                            projectID: p.ID, projectCode: p.code, projectName: p.name,
                            milestoneType: m.milestoneType, dueDate: m.forecastEnd, status: m.status
                        };
                    })
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
                staleProjects: projects.filter((p) => Date.parse(p.lastUpdateAt) < staleLimit).map(ref),
                projectsToReview: projects.filter((p) => p.needsReview).map(ref)
            };
        }

        return this.throwError("Not mocked: " + actionDefinition.name, 501);
    }
};
