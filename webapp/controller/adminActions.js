sap.ui.define([
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../model/adminRules",
    "../model/adminTabs",
    "./adminBulk"
], function (ActionSheet, Button, MessageBox, MessageToast, adminRules, adminTabs, adminBulk) {
    "use strict";

    /** The batch group /admin changes are sent in. */
    var ADMIN_GROUP = "adminEdit";

    /**
     * The changes an Administrator makes on the tab on show (Pessoas,
     * Clientes, Módulos, Tipos de marco; model/adminTabs.js), through /admin
     * (golive-tracker-api, srv/admin-service.js): new, edit, deactivate or
     * activate, and delete. What is in use (a person or client with project
     * history, a module or milestone type projects have) is deactivated,
     * never deleted: the API answers 409 and the ErrorHandler shows why.
     * Many at a time (Importar, Eliminar selecionados) is ./adminBulk,
     * brought in with this. Mixed into Admin.controller.js, so `this` is that
     * controller; it implements _tab() and _load(iPage).
     */
    return Object.assign({}, adminBulk, {

        /**
         * After every change: the page is read again, and the modules and
         * milestone types the whole app offers, when they are what changed.
         * @param {string} sToastKey i18n key of the toast
         * @private
         */
        _onRecordsChanged: function (sToastKey) {
            MessageToast.show(this.getResourceBundle().getText(sToastKey));
            this._load(this.getModel("dir").getProperty("/page"));
            this._reloadListsIfManaged();
        },

        /**
         * After a change to Módulos or Tipos de marco, the app's lists (model/lists.js).
         * @private
         */
        _reloadListsIfManaged: function () {
            var sKind = this._tab().kind;

            if (sKind === "module" || sKind === "milestoneType") {
                this.getOwnerComponent().loadLists();
            }
        },

        /**
         * Nova pessoa / Novo cliente / Novo módulo / Novo tipo de marco.
         * @public
         */
        onNew: function () {
            var oTab = this._tab();

            this._oRecordRow = null;
            this._openRecord({
                kind: oTab.kind,
                mode: "create",
                title: this.getResourceBundle().getText(oTab.texts.newText),
                values: Object.assign({}, oTab.empty)
            });
        },

        /**
         * A row's "…": Editar, Desativar or Ativar, Eliminar.
         * @param {sap.ui.base.Event} oEvent press of the row's button
         * @public
         */
        onRowActions: function (oEvent) {
            var oButton = oEvent.getSource(),
                oRow = oButton.getBindingContext("dir").getObject(),
                oBundle = this.getResourceBundle(),
                bActive = oRow.active !== false;

            if (this._oRecordMenu) {
                this._oRecordMenu.destroy();
            }
            this._oRecordMenu = new ActionSheet({
                placement: "Bottom",
                buttons: [
                    new Button({ text: oBundle.getText("auditEdit"), icon: "sap-icon://edit", press: this._editRecord.bind(this, oRow) }),
                    new Button({
                        text: oBundle.getText(bActive ? "admDeactivate" : "admActivate"),
                        icon: bActive ? "sap-icon://decline" : "sap-icon://accept",
                        press: this._setActive.bind(this, oRow, !bActive)
                    }),
                    new Button({ text: oBundle.getText("auditDelete"), icon: "sap-icon://delete", type: "Reject", press: this._deleteRecord.bind(this, oRow) })
                ]
            });
            this.getView().addDependent(this._oRecordMenu);
            this._oRecordMenu.openBy(oButton);
        },

        onSaveRecord: function () {
            var oRecord = this.getModel("record"),
                oTab = this._tab(),
                oValues = oRecord.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oKeys = oTab.validate.call(adminRules, oValues),
                oErrors = {},
                oBody;

            Object.keys(oKeys).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oKeys[sField]);
            });
            oRecord.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }
            oBody = oTab.body(oValues);
            oRecord.setProperty("/busy", true);
            (oRecord.getProperty("/mode") === "create"
                ? this._createRecord(oBody)
                : this._patchRecord(this._oRecordRow, adminRules.changes(this._oRecordRow, oBody, oTab.fields))
            ).then(function (bDone) {
                oRecord.setProperty("/busy", false);
                if (bDone) {
                    this.onCancelRecord();
                    this._onRecordsChanged("admSaved");
                }
            }.bind(this));
        },

        /**
         * A profile card chosen in Nova pessoa / Editar pessoa.
         * @param {sap.ui.base.Event} oEvent selectionChange of the cards' list
         * @public
         */
        onProfileSelect: function (oEvent) {
            this.getModel("record").setProperty("/values/profile", oEvent.getParameter("listItem").data("profile"));
        },

        onCancelRecord: function () {
            this._getRecordDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * @param {object} oRow the row
         * @private
         */
        _editRecord: function (oRow) {
            var oTab = this._tab(),
                oValues = {};

            Object.keys(oTab.empty).forEach(function (sField) {
                oValues[sField] = oRow[sField] === null || oRow[sField] === undefined ? oTab.empty[sField] : oRow[sField];
            });
            oValues.active = oRow.active !== false;
            this._oRecordRow = oRow;
            this._openRecord({
                kind: oTab.kind,
                mode: "edit",
                title: this.getResourceBundle().getText(oTab.texts.editTitle, [oRow.name]),
                values: oValues
            });
        },

        /**
         * Desativar / Ativar: PATCH active.
         * @param {object} oRow the row
         * @param {boolean} bActive the new state
         * @private
         */
        _setActive: function (oRow, bActive) {
            this._patchRecord(oRow, { active: bActive }).then(function (bDone) {
                if (bDone) {
                    this._onRecordsChanged(bActive ? "admActivated" : "admDeactivated");
                }
            }.bind(this));
        },

        /**
         * Asks first, then DELETE. What is in use is refused (409) and
         * stays; the message says to deactivate instead.
         * @param {object} oRow the row
         * @private
         */
        _deleteRecord: function (oRow) {
            var oModel = this.getOwnerComponent().getModel("admin"),
                sPath = adminTabs.path(this.getModel("dir").getProperty("/tab"), oRow);

            MessageBox.confirm(this.getResourceBundle().getText("admDeleteConfirm", [oRow.name]), {
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    var oBinding, oContext;

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    oBinding = oModel.bindContext(sPath, undefined, { $$updateGroupId: ADMIN_GROUP });
                    oContext = oBinding.getBoundContext();
                    oContext.requestObject().then(function () {
                        oContext.delete(ADMIN_GROUP).catch(function () {
                            // a refusal is reported by the ErrorHandler
                        });
                        return oModel.submitBatch(ADMIN_GROUP);
                    }).then(function () {
                        if (oModel.hasPendingChanges(ADMIN_GROUP)) {
                            oModel.resetChanges(ADMIN_GROUP);
                        } else {
                            this._onRecordsChanged("admDeleted");
                        }
                        oBinding.destroy();
                    }.bind(this));
                }.bind(this)
            });
        },

        /**
         * POST to the tab's entity set under /admin.
         * @param {object} oBody the record
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _createRecord: function (oBody) {
            var oModel = this.getOwnerComponent().getModel("admin"),
                oBinding = oModel.bindList("/" + this._tab().set, undefined, [], [], { $$updateGroupId: ADMIN_GROUP }),
                oContext = oBinding.create(oBody);

            oContext.created().catch(function () {
                // taken back by resetChanges below on a refusal
            });
            return oModel.submitBatch(ADMIN_GROUP).then(function () {
                var bDone = !oModel.hasPendingChanges(ADMIN_GROUP);

                if (!bDone) {
                    oModel.resetChanges(ADMIN_GROUP);
                }
                oBinding.destroy();
                return bDone;
            });
        },

        /**
         * PATCH a record of the tab under /admin with the changes.
         * @param {object} oRow the record as read
         * @param {object} oChanges the fields to change
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _patchRecord: function (oRow, oChanges) {
            var oModel = this.getOwnerComponent().getModel("admin"),
                oBinding = oModel.bindContext(adminTabs.path(this.getModel("dir").getProperty("/tab"), oRow), undefined,
                    { $$updateGroupId: ADMIN_GROUP }),
                oContext = oBinding.getBoundContext();

            if (!Object.keys(oChanges).length) {
                oBinding.destroy();
                return Promise.resolve(true);
            }
            return oContext.requestObject().then(function () {
                Object.keys(oChanges).forEach(function (sField) {
                    oContext.setProperty(sField, oChanges[sField], ADMIN_GROUP).catch(function () {
                        // settled with the batch, below
                    });
                });
                return oModel.submitBatch(ADMIN_GROUP);
            }).then(function () {
                var bDone = !oModel.hasPendingChanges(ADMIN_GROUP);

                if (!bDone) {
                    oModel.resetChanges(ADMIN_GROUP);
                }
                oBinding.destroy();
                return bDone;
            });
        },

        /**
         * @param {object} oState kind, mode, title and values
         * @private
         */
        _openRecord: function (oState) {
            this.getModel("record").setData(Object.assign({ busy: false, errors: {} }, oState));
            this._getRecordDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * @returns {Promise<sap.m.Dialog>} the record dialog, loaded once
         * @private
         */
        _getRecordDialog: function () {
            if (!this._pRecordDialog) {
                this._pRecordDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.AdminDialog" });
            }
            return this._pRecordDialog;
        }
    });
});
