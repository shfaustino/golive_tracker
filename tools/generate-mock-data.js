"use strict";

// Writes the mock data `npm run start-mock` serves
// (webapp/localService/project/data/*.json). Deterministic: the same run gives
// the same files, so they can be committed and diffed. Dates are placed around
// TODAY, so overdue milestones and "a rever" projects exist whenever it runs.
//
//   npm run mock:generate

const fs = require("node:fs");
const path = require("node:path");

const OUT = path.join(__dirname, "..", "webapp", "localService", "project", "data");
const TODAY = new Date(Date.UTC(2026, 9, 6));

let seed = 42;
function random() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
}
function pick(a) {
    return a[Math.floor(random() * a.length)];
}
let uuidCounter = 0;
function uuid(prefix) {
    uuidCounter += 1;
    const hex = (prefix + uuidCounter.toString(16)).padStart(12, "0").slice(-12);
    return "00000000-0000-4000-8000-" + hex;
}
function addDays(oDate, iDays) {
    return new Date(oDate.getTime() + iDays * 86400000);
}
function isoDate(oDate) {
    return oDate.toISOString().slice(0, 10);
}

const PEOPLE = [
    ["Marlon Teixeira", "Administrator"], ["Ana Silva", "Administrator"], ["João Pereira", "Architect"],
    ["Maria Santos", "User"], ["Pedro Costa", "User"], ["Carla Mendes", "User"], ["Rui Almeida", "Architect"],
    ["Sofia Carvalho", "User"], ["Miguel Rodrigues", "User"], ["Beatriz Oliveira", "User"],
    ["Tiago Ferreira", "User"], ["Marcos Silva", "User"], ["Marta Oliveira", "User"], ["Carlos Mendes", "User"],
    ["Ricardo Alves", "User"], ["Sofia Almeida", "User"], ["Mariana Lopes", "User"], ["Ana Pereira", "User"],
    ["João Santos", "User"]
].map(function ([name, profile], i) {
    const email = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ /g, ".") + "@amt-consulting.com";

    return { ID: uuid("a"), name, email, profile, active: i !== 5 };
});

const CLIENTS = ["Cliente A", "Cliente B", "Cliente C", "Cliente D", "Cliente E", "Cliente F", "Cerejeira SA", "Lusitânia Retail"]
    .map(function (name, i) {
        return { ID: uuid("c"), name, taxId: String(500000001 + i), active: true };
    });

const PROJECT_NAMES = [
    "Implementação SAP S/4HANA", "Migração SAP S/4HANA", "Novo Portal", "Melhoria Analytics", "Portal do Cliente",
    "Integração CRM", "Modernização Infra", "Integração Sistemas", "Segurança e Compliance", "Apps Mobile",
    "SuccessFactors Employee Central", "Recrutamento e Onboarding", "Performance & Goals", "Learning Management",
    "Compensation Planning", "Rollout Espanha", "Rollout Brasil", "Work Zone Intranet", "Time Tracking",
    "Assessment HR Digital", "Change Management S/4", "Bolsa de horas 2026", "Integração Payroll", "Relatórios Financeiros"
];

const TEMPLATES = {
    "Implementation": ["KO", "PTO", "GOP", "Training", "Testing", "Go-live", "Closure"],
    "Rollout": ["KO", "GOP", "Testing", "Go-live", "Closure"],
    "Integration": ["KO", "PTO", "Testing", "Go-live", "Closure"],
    "Enhancements/CR": ["KO", "Testing", "Go-live", "Closure"],
    "Assessment": ["KO", "Report delivery", "Closure"],
    "Change management": ["KO", "Training", "Closure"],
    "Hours bank": []
};
const TYPES = Object.keys(TEMPLATES);
const STATUSES = ["InProgress", "InProgress", "InProgress", "NotStarted", "OnHold", "Replanning", "Closing", "Closed", "Cancelled"];
const MODULES = ["EC", "ECP", "TT", "P&G", "REC", "ONB", "LMS", "Compensation", "Workzone", "FI", "SD", "EWM"];
const ROLES = ["Functional lead", "Technical lead", "Testing owner", "Requirements owner", "Architect"];

const projects = [];
const members = [];
const milestones = [];
const owners = [];
const modules = [];

PROJECT_NAMES.forEach(function (name, i) {
    const ID = uuid("b");
    const projectType = i < 12 ? TYPES[i % 4] : pick(TYPES);
    const status = i === 0 ? "InProgress" : pick(STATUSES);
    const start = addDays(TODAY, -Math.floor(60 + random() * 300));
    const end = addDays(start, Math.floor(180 + random() * 400));
    const team = [];

    // the PM, and two to four more people in other roles
    const pmPerson = PEOPLE[3 + (i % (PEOPLE.length - 3))];
    const pm = { ID: uuid("d"), project_ID: ID, person_ID: pmPerson.ID, role: "PM", startDate: isoDate(start), endDate: null };
    members.push(pm);
    team.push(pmPerson);
    for (let n = 0; n < 2 + Math.floor(random() * 3); n += 1) {
        const person = pick(PEOPLE);
        if (team.indexOf(person) === -1) {
            team.push(person);
            members.push({
                ID: uuid("d"), project_ID: ID, person_ID: person.ID, role: pick(ROLES),
                startDate: isoDate(start), endDate: random() < 0.15 ? isoDate(addDays(TODAY, -20)) : null
            });
        }
    }

    for (let n = 0; n < 1 + Math.floor(random() * 3); n += 1) {
        const module = pick(MODULES);
        if (!modules.some((m) => m.project_ID === ID && m.module === module)) {
            modules.push({ ID: uuid("e"), project_ID: ID, module });
        }
    }

    // milestones spread from the start to the end; the ones in the past are
    // mostly done, one in a few is late
    const types = TEMPLATES[projectType];
    types.forEach(function (milestoneType, n) {
        const forecastEnd = addDays(start, Math.round((end - start) / 86400000 * (n + 1) / types.length));
        const forecastStart = addDays(forecastEnd, -14);
        const past = forecastEnd < TODAY;
        let msStatus = "Planned";

        if (status === "Closed" || status === "Closing") {
            msStatus = "Completed";
        } else if (past) {
            msStatus = random() < 0.75 ? "Completed" : "InProgress";
        } else if (forecastStart < TODAY) {
            msStatus = "InProgress";
        }
        const msID = uuid("f");
        milestones.push({
            ID: msID,
            project_ID: ID,
            milestoneType,
            sortOrder: n + 1,
            mandatory: true,
            status: msStatus,
            forecastStart: isoDate(forecastStart),
            forecastEnd: isoDate(forecastEnd),
            baselineStart: isoDate(forecastStart),
            baselineEnd: isoDate(forecastEnd),
            actualDate: msStatus === "Completed" ? isoDate(addDays(forecastEnd, Math.floor(random() * 7) - 3)) : null,
            isEstimated: !past && random() < 0.1,
            isOverdue: forecastEnd < TODAY && ["Planned", "InProgress", "Postponed"].indexOf(msStatus) !== -1,
            itemsCompletion: msStatus === "Completed" ? 100 : Math.floor(random() * 90),
            justification: null,
            changeReason: null
        });
        team.slice(0, 1 + Math.floor(random() * Math.min(4, team.length))).forEach(function (person) {
            owners.push({ ID: uuid("g"), milestone_ID: msID, person_ID: person.ID });
        });
    });

    const needsReview = i % 5 === 1;
    projects.push({
        ID,
        code: "CO-T-" + String(i + 1).padStart(4, "0"),
        externalCode: "EXT-" + (3200 + i),
        name,
        projectType,
        status,
        startDate: isoDate(start),
        endDate: isoDate(end),
        value: Math.round(10000 + random() * 240000),
        currency_code: pick(["EUR", "EUR", "EUR", "USD", "GBP"]),
        client_ID: CLIENTS[i % CLIENTS.length].ID,
        pm_ID: pm.ID,
        needsReview,
        reviewReason: needsReview ? "GOP date was not clear in the source Excel; fill it in." : null,
        lastUpdateAt: addDays(TODAY, -Math.floor(random() * 45)).toISOString().replace(".000Z", "Z")
    });
});

const files = {
    Projects: projects,
    Members: members,
    Milestones: milestones,
    MilestoneOwners: owners,
    ProjectModules: modules,
    Clients: CLIENTS,
    People: PEOPLE,
    Currencies: [{ code: "EUR", name: "Euro" }, { code: "USD", name: "US Dollar" }, { code: "GBP", name: "British Pound" }]
};

fs.mkdirSync(OUT, { recursive: true });
Object.keys(files).forEach(function (name) {
    fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(files[name], null, 2) + "\n");
});
console.log("Mock data written to " + path.relative(process.cwd(), OUT));
