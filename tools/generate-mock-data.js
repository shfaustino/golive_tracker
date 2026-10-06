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
// prefix: one hex digit per kind of row, so ids stay valid GUIDs and the
// kind can be read off an id when debugging.
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
        return { ID: uuid("c"), name, taxId: String(500000001 + i), erpCode: "ERP-" + String(1001 + i), active: true };
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
            owners.push({ ID: uuid("9"), milestone_ID: msID, person_ID: person.ID });
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

// Status updates, generated last so that adding them left every earlier id
// as it was: two to four per project, newest first, one in four automatic.
const UPDATE_TEXTS = [
    "Reunião de acompanhamento com o cliente; próximos passos acordados.",
    "Documentação funcional revista e enviada para validação.",
    "Ambiente de testes disponível; testes de integração a decorrer.",
    "Cliente pediu para adiar a formação uma semana.",
    "Configuração concluída no ambiente de qualidade.",
    "Riscos revistos: dependência de dados mestre do cliente."
];
const updates = [];
projects.forEach(function (project) {
    const n = 2 + Math.floor(random() * 3);

    for (let k = 0; k < n; k += 1) {
        const automatic = random() < 0.25;

        updates.push({
            ID: uuid("8"),
            project_ID: project.ID,
            text: automatic ? "Status changed from NotStarted to " + project.status + "." : pick(UPDATE_TEXTS),
            milestone_ID: null,
            isAutomatic: automatic,
            author_ID: pick(PEOPLE).ID,
            postedAt: addDays(new Date(project.lastUpdateAt), -k * (3 + Math.floor(random() * 6))).toISOString().replace(".000Z", "Z")
        });
    }
});

// O meu trabalho for the signed-in mock user (the first person): a member
// of eight projects, owner of some of their milestones, and of items under
// them. Generated after everything above, so no earlier id moves.
const ME = PEOPLE[0];
const ITEM_NAMES = [
    ["Rever documentação funcional", "Document"], ["Reunião de acompanhamento", "Meeting"],
    ["Executar testes de carga", "Task"], ["Validação de dados mestres", "Task"],
    ["Preparar ambiente de produção", "Task"], ["Checklist de go-live", "Task"],
    ["Atualizar manual do utilizador", "Document"], ["Aprovação final do cliente", "Meeting"],
    ["Corrigir observações da auditoria", "FollowUp"], ["Configuração de autorizações", "Task"]
];
const myItems = [];
const myMilestones = [];
projects.filter((p) => ["InProgress", "OnHold", "Replanning"].includes(p.status)).slice(0, 8).forEach(function (project) {
    if (!members.some((m) => m.project_ID === project.ID && m.person_ID === ME.ID)) {
        members.push({ ID: uuid("d"), project_ID: project.ID, person_ID: ME.ID, role: "Functional lead", startDate: project.startDate, endDate: null });
    }
    milestones.filter((m) => m.project_ID === project.ID).slice(0, 4).forEach(function (milestone, n) {
        if (n % 2 === 0) {
            owners.push({ ID: uuid("9"), milestone_ID: milestone.ID, person_ID: ME.ID });
            myMilestones.push({
                ID: milestone.ID, milestoneType: milestone.milestoneType, status: milestone.status,
                forecastEnd: milestone.forecastEnd, isOverdue: milestone.isOverdue,
                project_ID: project.ID, projectCode: project.code, projectName: project.name
            });
        }
        const [name, type] = pick(ITEM_NAMES);
        const date = isoDate(addDays(TODAY, Math.floor(random() * 50) - 18));
        const status = date < isoDate(TODAY) ? pick(["Done", "InProgress", "ToDo"]) : pick(["ToDo", "InProgress", "ToDo"]);

        myItems.push({
            ID: uuid("7"), name, type, status, date,
            isOverdue: date < isoDate(TODAY) && (status === "ToDo" || status === "InProgress"),
            milestone_ID: milestone.ID, milestoneType: milestone.milestoneType,
            project_ID: project.ID, projectCode: project.code, projectName: project.name
        });
    });
});

// RecentUpdates: the API's view of all updates, project and author flattened in.
const recentUpdates = updates.map(function (u) {
    const project = projects.find((p) => p.ID === u.project_ID);
    const author = PEOPLE.find((p) => p.ID === u.author_ID);

    return {
        ID: u.ID, project_ID: u.project_ID, author_ID: u.author_ID, postedAt: u.postedAt, text: u.text,
        isAutomatic: u.isAutomatic, projectCode: project.code, projectName: project.name, authorName: author.name
    };
});

// Which milestones need an audit (★ in the guide's table, BR-10). Set from
// the type alone, so no random draw and no id moves.
const AUDITED = {
    "Implementation": ["GOP", "Testing", "Go-live"],
    "Rollout": ["Testing", "Go-live"]
};
milestones.forEach(function (milestone) {
    const project = projects.find((p) => p.ID === milestone.project_ID);

    milestone.requiresAudit = (AUDITED[project.projectType] || []).includes(milestone.milestoneType);
});

// Audits on the audited milestones already reached, and their follow-ups
// (items of type FollowUp under the audited milestone).
const RESULTS = ["Approved", "Approved", "ApprovedWithReservations", "Rejected"];
const FOLLOW_UPS = [
    "Corrigir observações da auditoria", "Validar unidades organizacionais", "Rever plano de testes",
    "Completar documentação de go-live", "Repetir testes de integração"
];
const audits = [];
const items = [];
milestones.filter((m) => m.requiresAudit && ["Completed", "InProgress"].includes(m.status)).forEach(function (milestone) {
    const project = projects.find((p) => p.ID === milestone.project_ID);
    const team = members.filter((m) => m.project_ID === project.ID && !m.endDate);
    const date = milestone.actualDate || milestone.forecastEnd;
    const auditID = uuid("6");
    const result = pick(RESULTS);
    const number = project.code.replace(/\D/g, "").replace(/^0+/, "");

    audits.push({
        ID: auditID, milestone_ID: milestone.ID,
        code: number + "_" + milestone.milestoneType.replace(/[^A-Za-z]/g, "") + "_" + date.slice(8, 10) + date.slice(5, 7) + date.slice(0, 4),
        date, auditor_ID: pick(PEOPLE.slice(0, 3)).ID, result,
        notes: result === "Approved" ? "Sem observações." : "Observações registadas; ver follow-ups."
    });
    const n = result === "Approved" ? Math.floor(random() * 2) : 1 + Math.floor(random() * 3);
    for (let k = 0; k < n; k += 1) {
        const due = isoDate(addDays(new Date(date + "T00:00:00Z"), 7 + k * 7));

        items.push({
            ID: uuid("5"), milestone_ID: milestone.ID, type: "FollowUp", name: pick(FOLLOW_UPS), description: null,
            date: due, owner_ID: pick(team.length ? team : [{ person_ID: PEOPLE[3].ID }]).person_ID,
            status: due < isoDate(TODAY) ? pick(["Done", "Done", "InProgress"]) : pick(["ToDo", "InProgress"]),
            audit_ID: auditID, isOverdue: false
        });
    }
});
items.forEach(function (item) {
    item.isOverdue = item.date < isoDate(TODAY) && (item.status === "ToDo" || item.status === "InProgress");
});

// Attachments: links on projects, milestones and items, and AllAttachments,
// the API's view of them with the project, milestone and item flattened in.
const DOCS = [
    ["Proposal", "Proposta comercial"], ["Contract", "Contrato assinado"], ["Project plan", "Plano de projeto"],
    ["Status report", "Relatório de estado"], ["KO minutes", "Ata de kick-off"], ["GOP presentation", "Apresentação GOP"],
    ["Test plan", "Plano de testes"], ["Final report", "Relatório final"]
];
const attachments = [];
projects.slice(0, 10).forEach(function (project, n) {
    const projectMilestones = milestones.filter((m) => m.project_ID === project.ID);
    const folder = "https://amtconsulting.sharepoint.com/sites/" + project.code + "/";
    const add = function (doc, owner) {
        attachments.push(Object.assign({
            ID: uuid("4"), documentType: doc[0], name: doc[1] + (n % 3 ? "" : " v2"),
            url: folder + doc[1].replace(/\s+/g, "_") + ".pdf", author_ID: pick(PEOPLE.slice(0, 6)).ID,
            createdAt: addDays(new Date(project.startDate + "T09:00:00Z"), Math.floor(random() * 90)).toISOString().replace(".000Z", "Z"),
            project_ID: null, milestone_ID: null, milestoneItem_ID: null
        }, owner));
    };

    add(DOCS[0], { project_ID: project.ID });
    if (random() < 0.6) {
        add(DOCS[1], { project_ID: project.ID });
    }
    if (projectMilestones[0]) {
        add(DOCS[4], { milestone_ID: projectMilestones[0].ID });
    }
    const gop = projectMilestones.find((m) => m.milestoneType === "GOP");
    if (gop) {
        add(DOCS[5], { milestone_ID: gop.ID });
    }
    const item = items.find((i) => projectMilestones.some((m) => m.ID === i.milestone_ID));
    if (item) {
        add(DOCS[6], { milestoneItem_ID: item.ID });
    }
});
const allAttachments = attachments.map(function (a) {
    const item = a.milestoneItem_ID && items.find((i) => i.ID === a.milestoneItem_ID);
    const milestone = milestones.find((m) => m.ID === (a.milestone_ID || (item && item.milestone_ID)));
    const project = projects.find((p) => p.ID === (a.project_ID || (milestone && milestone.project_ID)));

    return Object.assign({}, a, {
        projectID: project.ID, projectCode: project.code, projectName: project.name,
        milestoneType: milestone ? milestone.milestoneType : null, module: null, itemName: item ? item.name : null
    });
});

const files = {
    Attachments: attachments,
    AllAttachments: allAttachments,
    Audits: audits,
    MilestoneItems: items,
    RecentUpdates: recentUpdates,
    MyItems: myItems,
    MyMilestones: myMilestones,
    Updates: updates,
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

// The /admin mock: the same people and clients, inactive ones included,
// with every field AdminService has. A few more clients, some inactive, so
// the Clientes tab has something to page through.
const ADMIN_OUT = path.join(__dirname, "..", "webapp", "localService", "admin", "data");
const moreClients = ["Atlântico Seguros", "Norte Logística", "Vinhos do Douro", "Saúde Mais", "TecnoPorto"]
    .map(function (name, i) {
        return { ID: uuid("c"), name, taxId: String(500000101 + i), erpCode: "ERP-" + String(2001 + i), active: i !== 2 };
    });
fs.mkdirSync(ADMIN_OUT, { recursive: true });
fs.writeFileSync(path.join(ADMIN_OUT, "People.json"), JSON.stringify(PEOPLE, null, 2) + "\n");
fs.writeFileSync(path.join(ADMIN_OUT, "Clients.json"), JSON.stringify(CLIENTS.concat(moreClients), null, 2) + "\n");

console.log("Mock data written to " + path.relative(process.cwd(), OUT) + " and " + path.relative(process.cwd(), ADMIN_OUT));
