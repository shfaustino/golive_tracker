sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../service/childWrites"
], function (JSONModel, MessageToast, childWrites) {
    "use strict";

    /** The status the API answers when a record has history and cannot be deleted (BR-13) */
    var HAS_HISTORY = 409;

    /**
     * Eliminar selecionados, for a page whose table an Administrator selects
     * rows in (Projetos, Pessoas, Clientes): the selected records are listed,
     * the number of them typed to confirm, then each one is deleted, one
     * DELETE after the other, and each row says whether it was deleted or
     * why not. Where records with history are deactivated instead of
     * deleted (people, clients), those the API refused for that can then be
     * deactivated together. Mixed into the page's controller, which
     * implements _bulkSetup().
     */
    return {

        /**
         * The selection changed: the button shows how many are selected.
         * @public
         */
        onBulkSelectionChange: function () {
            var oSetup = this._bulkSetup();

            oSetup.setCount(oSetup.table.getSelectedItems().length);
        },

        /** @public */
        onDeleteSelected: function () {
            var oSetup = this._bulkSetup(),
                aRows = oSetup.table.getSelectedItems().map(function (oItem) {
                    return Object.assign({ state: "None", stateText: "", message: "", refused: false },
                        oSetup.row(oItem.getBindingContext(oSetup.rowModel).getObject()));
                });

            if (!this.getModel("bulk")) {
                this.setModel(new JSONModel({}), "bulk");
            }
            this.getModel("bulk").setData(Object.assign({
                busy: false, done: false, rows: aRows, count: String(aRows.length), typed: "", refused: 0
            }, oSetup.texts));
            this._getBulkDeleteDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * Eliminar: one DELETE after the other, each row saying how it went.
         * @public
         */
        onConfirmBulkDelete: function () {
            var oSetup = this._bulkSetup(),
                oBundle = this.getResourceBundle();

            this._bulkEach(function (oRow) {
                return childWrites.request(oSetup.model, "DELETE", oSetup.path(oRow));
            }, function (oRow, oResult) {
                // refused because of history: it can be deactivated instead
                var bRefused = !oResult.ok && oResult.status === HAS_HISTORY && oSetup.canDeactivate;

                return {
                    state: oResult.ok ? "Success" : "Error",
                    stateText: oBundle.getText(oResult.ok ? "bulkDeleted" : "bulkNotDeleted"),
                    message: oResult.message,
                    refused: bRefused
                };
            }, "bulkDone");
        },

        /**
         * Desativar estes: the records the API would not delete, deactivated.
         * @public
         */
        onDeactivateRefused: function () {
            var oSetup = this._bulkSetup(),
                oBundle = this.getResourceBundle();

            this._bulkEach(function (oRow) {
                return oRow.refused ? childWrites.request(oSetup.model, "PATCH", oSetup.path(oRow), { active: false }) : null;
            }, function (oRow, oResult) {
                return {
                    state: oResult.ok ? "Warning" : "Error",
                    stateText: oBundle.getText(oResult.ok ? "bulkDeactivated" : "bulkNotDeleted"),
                    message: oResult.ok ? "" : oResult.message,
                    refused: !oResult.ok
                };
            }, "bulkDeactivatedDone");
        },

        /** @public */
        onCloseBulkDelete: function () {
            this._getBulkDeleteDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * One request per row, in order, then the page read again.
         * @param {function(object): (Promise|null)} fnSend the request for a row; null skips it
         * @param {function(object, object): object} fnState what the row shows after its answer
         * @param {string} sToastKey i18n key of the toast, with how many went through
         * @private
         */
        _bulkEach: function (fnSend, fnState, sToastKey) {
            var oBulk = this.getModel("bulk"),
                oSetup = this._bulkSetup(),
                iDone = 0;

            oBulk.setProperty("/busy", true);
            oBulk.getProperty("/rows").reduce(function (pPrevious, oRow, i) {
                return pPrevious.then(function () {
                    var pSend = fnSend(oRow);

                    return pSend && pSend.then(function (oResult) {
                        iDone += oResult.ok ? 1 : 0;
                        oBulk.setProperty("/rows/" + i, Object.assign({}, oRow, fnState(oRow, oResult)));
                    });
                });
            }, Promise.resolve()).then(function () {
                oBulk.setProperty("/busy", false);
                oBulk.setProperty("/done", true);
                oBulk.setProperty("/refused", oBulk.getProperty("/rows").filter(function (oRow) {
                    return oRow.refused;
                }).length);
                MessageToast.show(this.getResourceBundle().getText(sToastKey, [iDone]));
                oSetup.table.removeSelections(true);
                oSetup.setCount(0);
                oSetup.done();
            }.bind(this));
        },

        /** @private */
        _getBulkDeleteDialog: function () {
            if (!this._pBulkDeleteDialog) {
                this._pBulkDeleteDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.BulkDeleteDialog" });
            }
            return this._pBulkDeleteDialog;
        }
    };
});
