sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "./auditDialogs",
    "../model/auditRows"
], function (JSONModel, Filter, FilterOperator, Sorter, auditDialogs, auditRows) {
    "use strict";

    /**
     * A project's Auditorias tab: its audits, and the audit dialogs of the
     * Auditorias page (./auditDialogs, brought in with this). Mixed into
     * ProjectDetail.controller.js, so `this` is that controller; it calls
     * _initProjectAudits in onInit and _loadProjectAudits when the project
     * changes.
     */
    return Object.assign({}, auditDialogs, {

        /** @private */
        _initProjectAudits: function () {
            this._initAuditModels();
            this._sAuditRowModel = "projAudits";
            this._bAuditOpenProject = false;
            this.setModel(new JSONModel({ busy: false, rows: [] }), "projAudits");
        },

        onNewProjectAudit: function () {
            this.openNewAudit(this._sProjectId);
        },

        /**
         * Called by auditDialogs after every change.
         * @private
         */
        _onAuditsChanged: function () {
            this._loadProjectAudits();
        },

        /**
         * GET /project/Audits for the milestones of this project, newest first.
         * @private
         */
        _loadProjectAudits: function () {
            var oModel = this.getModel("projAudits"),
                sProjectId = this._sProjectId,
                oBinding = this.getOwnerComponent().getModel().bindList("/Audits", undefined, [new Sorter("date", true)],
                    [new Filter("milestone/project_ID", FilterOperator.EQ, sProjectId)], auditRows.QUERY);

            oModel.setProperty("/busy", true);
            oBinding.requestContexts(0, 200).then(function (aContexts) {
                if (sProjectId === this._sProjectId) {
                    oModel.setProperty("/rows", aContexts.map(function (oContext) {
                        return auditRows.flatten(oContext.getObject());
                    }));
                }
            }.bind(this)).catch(function () {
                oModel.setProperty("/rows", []);
            }).finally(function () {
                oModel.setProperty("/busy", false);
                oBinding.destroy();
            });
        }
    });
});
