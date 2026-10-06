"use strict";

// A UI5 server middleware for `npm run start-mock` only (ui5-mock.yaml).
//
// The app changes and deletes what lives under a project at the path under
// its parent, the only one the real API takes
// (PATCH /project/Projects(<id>)/milestones(<id>), see
// webapp/service/childWrites.js). The mock server keeps those entities in
// flat sets and does not resolve a write through a navigation path (a DELETE
// there even removes the parent). This rewrites such a PATCH or DELETE to the
// flat set the mock has (/project/Milestones(<id>)); the real API never sees
// this file.

const SETS = {
    milestones: "Milestones",
    members: "Members",
    updates: "Updates",
    attachments: "Attachments",
    items: "MilestoneItems",
    modules: "ProjectModules",
    owners: "MilestoneOwners"
};

// .../<navigation>(<key>) at the end of a path under /project/Projects(...)
const CHILD = /^\/project\/Projects\([^)]+\)(?:\/[A-Za-z]+\([^)]+\))*\/([A-Za-z]+)\(([^)]+)\)(\?.*)?$/;

module.exports = function ({ log }) {
    return function mockChildPaths(req, res, next) {
        const match = (req.method === "PATCH" || req.method === "DELETE") && CHILD.exec(req.url);

        if (match && SETS[match[1]]) {
            const target = `/project/${SETS[match[1]]}(${match[2]})${match[3] || ""}`;

            log.verbose(`${req.method} ${req.url} -> ${target}`);
            req.url = target;
        }
        next();
    };
};
