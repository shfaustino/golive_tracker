sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../model/milestoneSummary",
    "../formatter/formatter",
    "./projectTeam",
    "./projectHeader",
    "./projectRecordTabs"
], function (BaseController, JSONModel, MessageToast, milestoneSummary, formatter, projectTeam, projectHeader, projectRecordTabs) {
    "use strict";

    /** The tab a project opens on when the route names none. */
    var DEFAULT_TAB = "marcos";

    /** The batch group a milestone edit is sent in, as one PATCH. */
    var EDIT_GROUP = "milestoneEdit";

    // The Equipa tab's handlers live in ./projectTeam, the header's actions,
    // Visão geral, Módulos and Updates in ./projectHeader, and the
    // Auditorias and Anexos tabs in ./projectRecordTabs; all three are mixed in here.
    return BaseController.extend("com.amt.golivetracker.controller.ProjectDetail",
        Object.assign({}, projectTeam, projectHeader, projectRecordTabs, {

        formatter: formatter,

        onInit: function () {
            this.setModel(new JSONModel({
                busy: false,
                tab: DEFAULT_TAB,
                summary: milestoneSummary.summarise([])
            }), "detail");
            this.setModel(new JSONModel({ busy: false, values: {}, errors: {} }), "msEdit");
            this.setModel(new JSONModel({ busy: false, values: {}, errors: {}, people: [], roles: [] }), "member");
            this.setModel(new JSONModel({ busy: false, values: {}, errors: {}, statuses: [] }), "action");
            this.setModel(new JSONModel(this._emptyOverview()), "overview");
            this._initProjectRecordTabs();
            this.getRouter().getRoute("projectDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        onNavToProjects: function () {
            this.getRouter().navTo("projects");
        },

        /**
         * A tab was picked: it goes into the URL, replacing the history entry
         * so the back button leaves the project instead of walking its tabs.
         * @param {sap.ui.base.Event} oEvent select of the IconTabBar
         * @public
         */
        onTabSelect: function (oEvent) {
            this.getRouter().navTo("projectDetail", {
                projectId: this._sProjectId,
                tab: oEvent.getParameter("key")
            }, undefined, true);
        },

        /**
         * The milestones arrived (or were read again): the KPI row is counted
         * from them.
         * @public
         */
        onMilestonesUpdated: function () {
            var aMilestones = this.byId("milestonesTable").getBinding("items").getAllCurrentContexts()
                .map(function (oContext) {
                    return oContext.getObject();
                });

            this.getModel("detail").setProperty("/summary", milestoneSummary.summarise(aMilestones));
        },

        /**
         * Opens the edit dialog on a copy of the pressed milestone.
         * @param {sap.ui.base.Event} oEvent press of the row's edit button
         * @public
         */
        onEditMilestone: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext(),
                oMilestone = oContext.getObject(),
                oEditModel = this.getModel("msEdit");

            this._oEditContext = oContext;
            oEditModel.setData({
                busy: false,
                mode: "edit",
                title: this.getResourceBundle().getText("msEditTitle",
                    [formatter.milestoneTypeText.call(this, oMilestone.milestoneType)]),
                values: {
                    forecastStart: oMilestone.forecastStart || null,
                    forecastEnd: oMilestone.forecastEnd || null,
                    changeReason: "",
                    status: oMilestone.status,
                    actualDate: oMilestone.actualDate || null,
                    justification: oMilestone.justification || ""
                },
                errors: {}
            });
            this._getEditDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * "+ Novo marco": the same dialog, asking only for the type and the
         * forecast dates. The milestones a project type brings are generated
         * by the API; this adds extra ones, a GOP per module for instance.
         * @public
         */
        onNewMilestone: function () {
            this._oEditContext = null;
            this.getModel("msEdit").setData({
                busy: false,
                mode: "create",
                title: this.getResourceBundle().getText("msNew"),
                values: { milestoneType: "GOP", forecastStart: null, forecastEnd: null },
                errors: {}
            });
            this._getEditDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        onCancelMilestone: function () {
            this._getEditDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * Sends what changed, in one PATCH, after checking the rules the API
         * would refuse. A refusal from the API (the ErrorHandler shows its
         * message) leaves the dialog open and the row as it was.
         * @public
         */
        onSaveMilestone: function () {
            if (this.getModel("msEdit").getProperty("/mode") === "create") {
                this._createMilestone();
                return;
            }

            var oEditModel = this.getModel("msEdit"),
                oResult = milestoneSummary.editChanges(this._oEditContext.getObject(), oEditModel.getProperty("/values")),
                oBundle = this.getResourceBundle(),
                sMilestoneId = this._oEditContext.getProperty("ID"),
                aFields = Object.keys(oResult.changes),
                oErrors = {};

            Object.keys(oResult.errors).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oResult.errors[sField]);
            });
            oEditModel.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }
            if (!aFields.length) {
                this.onCancelMilestone();
                return;
            }

            // One PATCH under the project, which is the only path the API takes
            // for a milestone (BaseController#writeUnderParent).
            oEditModel.setProperty("/busy", true);
            this.writeUnderParent("PATCH", "/Projects(" + this._sProjectId + ")/milestones(" + sMilestoneId + ")",
                oResult.changes).then(function (bDone) {
                oEditModel.setProperty("/busy", false);
                if (!bDone) {
                    return;
                }
                MessageToast.show(oBundle.getText("msSaved"));
                this.onCancelMilestone();
                // isOverdue, itemsCompletion and the history are the API's to
                // work out again.
                this._refreshProject();
            }.bind(this));
        },

        /**
         * POSTs a new milestone under the project, in the edit group, so a
         * refusal can be taken back whole (resetChanges drops the new row).
         * @private
         */
        _createMilestone: function () {
            var oEditModel = this.getModel("msEdit"),
                oValues = oEditModel.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oModel = this.getOwnerComponent().getModel(),
                oErrors = {};

            if (!oValues.forecastEnd) {
                oErrors.forecastEnd = oBundle.getText("msErrorForecastEnd");
            } else if (oValues.forecastStart && oValues.forecastEnd < oValues.forecastStart) {
                oErrors.forecastEnd = oBundle.getText("msErrorEndBeforeStart");
            }
            oEditModel.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }

            oEditModel.setProperty("/busy", true);
            this.byId("milestonesTable").getBinding("items").create({
                milestoneType: oValues.milestoneType,
                forecastStart: oValues.forecastStart || null,
                forecastEnd: oValues.forecastEnd
            }, true);
            oModel.submitBatch(EDIT_GROUP).then(function () {
                oEditModel.setProperty("/busy", false);
                if (oModel.hasPendingChanges(EDIT_GROUP)) {
                    oModel.resetChanges(EDIT_GROUP);
                    return;
                }
                MessageToast.show(oBundle.getText("msCreated"));
                this.onCancelMilestone();
                // sortOrder, status and the rest are the API's to fill in.
                this._refreshProject();
            }.bind(this));
        },

        /**
         * What Visão geral and Módulos show before their reads answer.
         * @returns {object} the "overview" model's data
         * @private
         */
        _emptyOverview: function () {
            return {
                progress: { total: 0, done: 0, pct: 0, steps: [], next: null },
                progressBarHtml: "",
                progressText: "",
                nextDaysText: "",
                team: [],
                modules: [],
                updates: [],
                draft: "",
                posting: false
            };
        },

        /**
         * Binds the page to the project the route names. A project the user
         * may not see answers 404 as if it did not exist, and shows the not
         * found page.
         * @param {sap.ui.base.Event} oEvent patternMatched
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments"),
                oDetailModel = this.getModel("detail"),
                sPath = "/Projects(" + oArgs.projectId + ")";

            oDetailModel.setProperty("/tab", oArgs.tab || DEFAULT_TAB);
            if (this._sProjectId === oArgs.projectId) {
                return;
            }
            this._sProjectId = oArgs.projectId;
            this.getModel("overview").setData(this._emptyOverview());
            this._loadOverview();
            this._loadProjectRecordTabs();
            oDetailModel.setProperty("/summary", milestoneSummary.summarise([]));
            oDetailModel.setProperty("/busy", true);
            this.getView().bindElement(sPath);
            // Waits on the read itself rather than on dataReceived, which does
            // not fire when the request never goes out (the $metadata failed).
            this.getView().getElementBinding().getBoundContext().requestObject().then(function () {
                oDetailModel.setProperty("/busy", false);
            }).catch(function () {
                oDetailModel.setProperty("/busy", false);
                this._sProjectId = null;
                this.getRouter().getTargets().display("notFound");
            }.bind(this));
        },

        /**
         * The edit dialog, loaded the first time it is needed
         * (Controller#loadFragment makes it a dependent of the view).
         * @returns {Promise<sap.m.Dialog>} the dialog
         * @private
         */
        _getEditDialog: function () {
            if (!this._pEditDialog) {
                this._pEditDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.MilestoneEditDialog" });
            }
            return this._pEditDialog;
        }
    }));
});
