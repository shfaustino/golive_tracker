sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "../model/projectForm",
    "../formatter/formatter"
], function (MessageBox, MessageToast, JSONModel, projectForm, formatter) {
    "use strict";

    /**
     * The Módulos tab's changes: add a module to the project, or take one
     * off. Mixed into ProjectDetail.controller.js (through ./projectHeader),
     * so `this` is that controller.
     *
     * A module is a row of the project's "modules" composition, keyed by the
     * project and the module, with nothing else in it:
     * POST /Projects(<id>)/modules { module } and
     * DELETE /Projects(<id>)/modules(project_ID=<id>,module='<module>'),
     * both under the project (service/childWrites.js). Taking a module off
     * leaves the milestones made for it alone.
     */
    return {

        /**
         * "Adicionar módulo": the dialog, with the modules the project has not got.
         * @public
         */
        onAddModule: function () {
            var aTaken = (this.getModel("overview").getProperty("/modules") || []).map(function (oModule) {
                    return oModule.module;
                }),
                aChoices = projectForm.MODULES.filter(function (sModule) {
                    return aTaken.indexOf(sModule) === -1;
                }).map(function (sModule) {
                    return { key: sModule, name: formatter.moduleName(sModule) };
                });

            if (!aChoices.length) {
                MessageToast.show(this.getResourceBundle().getText("modAllAdded"));
                return;
            }
            this._getModuleModel().setData({ busy: false, choices: aChoices, module: "", error: "" });
            this._getModuleDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /** @public */
        onConfirmAddModule: function () {
            var oModel = this._getModuleModel(),
                sModule = oModel.getProperty("/module"),
                oBundle = this.getResourceBundle();

            if (!sModule) {
                oModel.setProperty("/error", oBundle.getText("modRequired"));
                return;
            }
            oModel.setProperty("/busy", true);
            this.writeUnderParent("POST", "/Projects(" + this._sProjectId + ")/modules", { module: sModule })
                .then(function (bDone) {
                    oModel.setProperty("/busy", false);
                    if (bDone) {
                        this.byId("moduleDialog").close();
                        MessageToast.show(oBundle.getText("modAdded", [sModule]));
                        this._refreshProject();
                    }
                }.bind(this));
        },

        /** @public */
        onCancelModule: function () {
            this.byId("moduleDialog").close();
        },

        /**
         * The "×" on a module's card, after a confirmation.
         * @param {sap.ui.base.Event} oEvent press of the button
         * @public
         */
        onRemoveModule: function (oEvent) {
            var sModule = oEvent.getSource().getBindingContext("overview").getProperty("module"),
                oBundle = this.getResourceBundle(),
                sId = this._sProjectId;

            MessageBox.confirm(oBundle.getText("modRemoveConfirm", [sModule]), {
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    this.writeUnderParent("DELETE", "/Projects(" + sId + ")/modules(project_ID=" + sId +
                        ",module='" + encodeURIComponent(sModule) + "')").then(function (bDone) {
                        if (bDone) {
                            MessageToast.show(oBundle.getText("modRemoved", [sModule]));
                            this._refreshProject();
                        }
                    }.bind(this));
                }.bind(this)
            });
        },

        /** @private */
        _getModuleModel: function () {
            if (!this.getModel("modAdd")) {
                this.setModel(new JSONModel({}), "modAdd");
            }
            return this.getModel("modAdd");
        },

        /** @private */
        _getModuleDialog: function () {
            if (!this._pModuleDialog) {
                this._pModuleDialog = this.loadFragment({
                    name: "com.amt.golivetracker.fragment.ModuleDialog"
                });
            }
            return this._pModuleDialog;
        }
    };
});
