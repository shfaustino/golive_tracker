sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/moduleBreakdown",
    "../model/projectOverview",
    "../model/memberRules",
    "../formatter/formatter"
], function (Filter, FilterOperator, moduleBreakdown, projectOverview, memberRules, formatter) {
    "use strict";

    /**
     * A module's page: the project page under the route projectModule
     * (Projetos/<id>/Modulos/<module>/<tab>), with the module's header and
     * the tabs Marcos, Equipa, Auditorias and Anexos showing only what is
     * the module's. What is created there goes on the module. The module
     * "Geral" (moduleBreakdown.WHOLE_PROJECT) is the whole project's
     * milestones, those of no module. Mixed into ProjectDetail.controller.js
     * (through ./projectModules), so `this` is that controller; the module
     * on show is detail>/module, "" on the project's own pages.
     */
    return {

        /**
         * The project's code in a module's breadcrumbs: back to its Módulos.
         * @public
         */
        onNavToProjectModules: function () {
            this.getRouter().navTo("projectDetail", { projectId: this._sProjectId, tab: "modulos" });
        },

        /**
         * "Abrir módulo" on a module's card, Geral's included.
         * @param {sap.ui.base.Event} oEvent press of the card's button
         * @public
         */
        onOpenModule: function (oEvent) {
            this.navToModule(this._sProjectId, oEvent.getSource().getBindingContext("overview").getProperty("module"));
        },

        /**
         * The count on the Auditorias and Anexos tabs: the module's rows on
         * its page, all of them on the project's.
         * @param {string} sModule the module on show, or ""
         * @param {{module: string}[]} aRows the project's rows
         * @returns {string} the count, empty for none
         * @public
         */
        recordCount: function (sModule, aRows) {
            var iCount = (aRows || []).filter(function (oRow) {
                return !sModule || moduleBreakdown.isOfModule(sModule, oRow.module);
            }).length;

            return iCount ? String(iCount) : "";
        },

        /**
         * The module what is created goes on: the one on show; none on the
         * project's pages and for the whole project.
         * @returns {string} the module, or ""
         * @private
         */
        _moduleOnShow: function () {
            var sModule = this.getModel("detail").getProperty("/module");

            return sModule === moduleBreakdown.WHOLE_PROJECT ? "" : sModule;
        },

        /**
         * Which milestones the audit and attachment dialogs offer: on a
         * module's page, the module's.
         * @returns {function(object): boolean|undefined} the test, none on the project's pages
         * @private
         */
        _moduleMilestoneFilter: function () {
            var sModule = this.getModel("detail").getProperty("/module");

            return sModule ? function (oMilestone) {
                return moduleBreakdown.isOfModule(sModule, oMilestone.module);
            } : undefined;
        },

        /**
         * On a module's page the tables show only what is the module's: its
         * milestones, its members, and the audits and attachments of its
         * milestones. For the whole project, the milestones of no module and
         * the whole team. On the project's pages, everything.
         * @param {string} sModule the module on show, or ""
         * @private
         */
        _applyModuleFilters: function (sModule) {
            var bWhole = sModule === moduleBreakdown.WHOLE_PROJECT,
                aRowFilters = sModule ? [new Filter({
                    path: "module",
                    // without it, the value comes to the test upper-cased
                    caseSensitive: true,
                    test: function (sRowModule) {
                        return moduleBreakdown.isOfModule(sModule, sRowModule);
                    }
                })] : [],
                aMilestoneFilters = [],
                aMemberFilters = [];

            if (sModule) {
                aMilestoneFilters = [new Filter("module", FilterOperator.EQ, bWhole ? null : sModule)];
            }
            if (sModule && !bWhole) {
                aMemberFilters = [new Filter({
                    path: "modules",
                    operator: FilterOperator.Any,
                    variable: "m",
                    condition: new Filter("m/module", FilterOperator.EQ, sModule)
                })];
            }
            this.byId("milestonesTable").getBinding("items").filter(aMilestoneFilters);
            this.byId("membersTable").getBinding("items").filter(aMemberFilters);
            this.byId("projectAuditsTable").getBinding("items").filter(aRowFilters);
            this.byId("attachmentsTable").getBinding("items").filter(aRowFilters);
        },

        /**
         * What a module's page shows above its tabs, from what Visão geral
         * reads: its name, progress, next milestone, go-live and leads.
         * @private
         */
        _updateModuleInfo: function () {
            var oDetailModel = this.getModel("detail"),
                oOverview = this.getModel("overview"),
                oBundle = this.getResourceBundle(),
                sModule = oDetailModel.getProperty("/module"),
                bWhole = sModule === moduleBreakdown.WHOLE_PROJECT,
                aMilestones, aTeam, oProgress, oGoLive, sName;

            if (!sModule) {
                oDetailModel.setProperty("/moduleInfo", {});
                return;
            }
            aMilestones = moduleBreakdown.milestonesOf(sModule, oOverview.getProperty("/milestones"));
            aTeam = moduleBreakdown.membersOf(sModule, oOverview.getProperty("/team"));
            oProgress = projectOverview.describe(aMilestones, memberRules.today());
            oGoLive = aMilestones.filter(function (oMilestone) {
                return oMilestone.milestoneType === "Go-live";
            })[0];
            sName = bWhole ? oBundle.getText("modWholeProject") : (formatter.moduleName(sModule) || sModule);
            oDetailModel.setProperty("/moduleInfo", {
                code: bWhole ? "" : sModule,
                name: sName,
                ofProject: oBundle.getText(bWhole ? "modOfProjectWhole" : "modOfProject"),
                msTitle: bWhole ? oBundle.getText("modMsTitleWhole") : oBundle.getText("modMsTitle", [sName]),
                pct: oProgress.pct,
                // as in Visão geral: the bar's width is the app's own number, nothing else goes in the HTML
                progressBarHtml: "<div class=\"gtProgressFill\" style=\"width:" + oProgress.pct + "%\"></div>",
                progressText: oBundle.getText("ovProgressText", [oProgress.done, oProgress.total]),
                nextText: oProgress.next
                    ? formatter.milestoneTypeText.call(this, oProgress.next.milestoneType) + " · " +
                        formatter.dateOrDash(oProgress.next.date)
                    : oBundle.getText("modAllDone"),
                goLive: oGoLive ? oGoLive.forecastEnd : null,
                leads: aTeam.filter(function (oMember) {
                    return oMember.role === "Functional lead" && oMember.person;
                }).map(function (oMember) {
                    return oMember.person.name;
                }).join(", ") || "—"
            });
        }
    };
});
