sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../service/childWrites"
], function (JSONModel, MessageToast, childWrites) {
    "use strict";

    /**
     * Eliminar projetos selecionados, on the Projetos page (Administrators
     * only: the table is MultiSelect for them, and the API refuses anyone
     * else). The selected projects of the page on show are listed, the
     * number of them typed to confirm, and then each one is deleted with
     * DELETE /Projects(<id>), which takes everything in it; each row then
     * says whether it was deleted or why not. Mixed into
     * Projects.controller.js through ./projectListActions, so `this` is
     * that controller; it implements _load(iPage).
     */
    return {

        /**
         * The selection changed: the button shows how many are selected.
         * @public
         */
        onProjectSelectionChange: function () {
            this.getModel("list").setProperty("/selectedCount", this.byId("projectsTable").getSelectedItems().length);
        },

        /** @public */
        onDeleteSelectedProjects: function () {
            var aRows = this.byId("projectsTable").getSelectedItems().map(function (oItem) {
                var oProject = oItem.getBindingContext("list").getObject();

                return { ID: oProject.ID, code: oProject.code, name: oProject.name, state: "None", stateText: "", message: "" };
            });

            if (!this.getModel("bulk")) {
                this.setModel(new JSONModel({}), "bulk");
            }
            this.getModel("bulk").setData({ busy: false, done: false, rows: aRows, count: String(aRows.length), typed: "" });
            this._getBulkDeleteDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * Eliminar: one DELETE after the other, each row saying how it went.
         * @public
         */
        onConfirmBulkDelete: function () {
            var oBulk = this.getModel("bulk"),
                oModel = this.getOwnerComponent().getModel(),
                oBundle = this.getResourceBundle(),
                iDeleted = 0;

            oBulk.setProperty("/busy", true);
            oBulk.getProperty("/rows").reduce(function (pPrevious, oRow, i) {
                return pPrevious.then(function () {
                    return childWrites.request(oModel, "DELETE", "/Projects(" + oRow.ID + ")");
                }).then(function (oResult) {
                    iDeleted += oResult.ok ? 1 : 0;
                    oBulk.setProperty("/rows/" + i + "/state", oResult.ok ? "Success" : "Error");
                    oBulk.setProperty("/rows/" + i + "/stateText", oBundle.getText(oResult.ok ? "bulkDeleted" : "bulkNotDeleted"));
                    oBulk.setProperty("/rows/" + i + "/message", oResult.message);
                });
            }, Promise.resolve()).then(function () {
                oBulk.setProperty("/busy", false);
                oBulk.setProperty("/done", true);
                MessageToast.show(oBundle.getText("bulkDone", [iDeleted]));
                this.byId("projectsTable").removeSelections(true);
                this.getModel("list").setProperty("/selectedCount", 0);
                // the lists that showed them read again
                oModel.refresh();
                this._load(this.getModel("list").getProperty("/page"));
            }.bind(this));
        },

        /** @public */
        onCloseBulkDelete: function () {
            this._getBulkDeleteDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /** @private */
        _getBulkDeleteDialog: function () {
            if (!this._pBulkDeleteDialog) {
                this._pBulkDeleteDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.ProjectBulkDeleteDialog" });
            }
            return this._pBulkDeleteDialog;
        }
    };
});
