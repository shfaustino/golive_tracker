sap.ui.define([
    "./adminRules"
], function (adminRules) {
    "use strict";

    /**
     * The tabs of Administração, each a list of records kept through /admin
     * (golive-tracker-api, srv/admin-service.cds): what it reads, how a
     * record is checked and sent, and its texts (i18n keys). Pessoas and
     * Clientes are also read by everyone through /project (read only);
     * Módulos and Tipos de marco are Administrators' only.
     */
    var TABS = {
        pessoas: {
            route: "people", kind: "person", set: "People", key: "ID", code: "email", orderBy: "name",
            select: "ID,name,email,profile,active", projectSelect: "ID,name,email,profile",
            table: "peopleTable", fields: adminRules.PERSON_FIELDS,
            validate: adminRules.validatePerson, body: adminRules.personBody,
            empty: { name: "", email: "", profile: "User", active: true },
            texts: {
                title: "navPeople", subtitle: "admPeopleSubtitle", newText: "admNewPerson", editTitle: "admEditPerson",
                range: "admRangePeople", codeLabel: "admEmail", bulkTitle: "bulkTitlePeople", bulkIntro: "bulkIntroPeople",
                importTitle: "impTitlePeople", importIntro: "impIntroPeople", extraLabel: "teamColProfile"
            }
        },
        clientes: {
            route: "clients", kind: "client", set: "Clients", key: "ID", code: "taxId", orderBy: "name",
            select: "ID,name,taxId,erpCode,active", projectSelect: "ID,name,erpCode",
            table: "clientsTable", fields: adminRules.CLIENT_FIELDS,
            validate: adminRules.validateClient, body: adminRules.clientBody,
            empty: { name: "", taxId: "", erpCode: "", active: true },
            texts: {
                title: "navClients", subtitle: "admClientsSubtitle", newText: "admNewClient", editTitle: "admEditClient",
                range: "admRangeClients", codeLabel: "admTaxId", bulkTitle: "bulkTitleClients", bulkIntro: "bulkIntroClients",
                importTitle: "impTitleClients", importIntro: "impIntroClients", extraLabel: "admErpCode"
            }
        },
        modulos: {
            route: "adminModules", kind: "module", set: "Modules", key: "code", code: "code", orderBy: "code",
            select: "code,name,active",
            table: "modulesTable", fields: adminRules.MODULE_FIELDS,
            validate: adminRules.validateModule, body: adminRules.moduleBody,
            empty: { code: "", name: "", active: true },
            texts: {
                title: "admModules", subtitle: "admModulesSubtitle", newText: "admNewModule", editTitle: "admEditModule",
                range: "admRangeModules", codeLabel: "admCode", bulkTitle: "bulkTitleModules", bulkIntro: "bulkIntroModules",
                importTitle: "impTitleModules", importIntro: "impIntroModules", extraLabel: ""
            }
        },
        tipos: {
            route: "adminMilestoneTypes", kind: "milestoneType", set: "MilestoneTypes", key: "code", code: "code", orderBy: "sortOrder,code",
            select: "code,name,requiresAudit,sortOrder,active",
            table: "typesTable", fields: adminRules.TYPE_FIELDS,
            validate: adminRules.validateType, body: adminRules.typeBody,
            empty: { code: "", name: "", requiresAudit: false, sortOrder: "", active: true },
            texts: {
                title: "admTypes", subtitle: "admTypesSubtitle", newText: "admNewType", editTitle: "admEditType",
                range: "admRangeTypes", codeLabel: "admCode", bulkTitle: "bulkTitleTypes", bulkIntro: "bulkIntroTypes",
                importTitle: "impTitleTypes", importIntro: "impIntroTypes", extraLabel: "admOrder"
            }
        }
    };

    return {

        TABS: TABS,

        /**
         * @param {string} sTab a tab's key
         * @returns {object} its configuration (Pessoas for one not known)
         */
        of: function (sTab) {
            return TABS[sTab] || TABS.pessoas;
        },

        /**
         * The tab a route opens on.
         * @param {string} sRoute the route's name
         * @returns {string} the tab's key
         */
        tabOfRoute: function (sRoute) {
            return Object.keys(TABS).filter(function (sTab) {
                return TABS[sTab].route === sRoute;
            })[0] || "pessoas";
        },

        /**
         * A record's path under /admin, e.g. /People(<uuid>) or /Modules('P%26G').
         * @param {string} sTab the tab's key
         * @param {object} oRecord the record (its key: ID or code)
         * @returns {string} the path
         */
        path: function (sTab, oRecord) {
            var oTab = this.of(sTab),
                vKey = oRecord[oTab.key];

            return "/" + oTab.set + "(" + (oTab.key === "ID" ? vKey
                : "'" + encodeURIComponent(String(vKey).replace(/'/g, "''")) + "'") + ")";
        }
    };
});
