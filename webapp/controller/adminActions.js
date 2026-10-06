sap.ui.define([
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/MessageBox",
    "../model/adminRules"
], function (ActionSheet, Button, MessageBox, adminRules) {
    "use strict";

    /** The batch group /admin changes are sent in. */
    var ADMIN_GROUP = "adminEdit";

    /**
     * The changes an Administrator makes on Pessoas and Clientes, through
     * /admin (golive-tracker-api, srv/admin-service.js): new, edit,
     * deactivate or activate, and delete. Who has project history is
     * deactivated, never deleted: the API answers 409 and the ErrorHandler
     * shows why. Mixed into Admin.controller.js, so `this` is that
     * controller; it implements _onRecordsChanged(sToastKey).
     */
    return {

        /**
         * Nova pessoa / Novo cliente, for the tab on show.
         * @public
         */
        onNew: function () {
            var bPeople = this.getModel("dir").getProperty("/tab") === "pessoas";

            this._oRecordRow = null;
            this._openRecord({
                kind: bPeople ? "person" : "client",
                mode: "create",
                title: this.getResourceBundle().getText(bPeople ? "admNewPerson" : "admNewClient"),
                values: bPeople
                    ? { name: "", email: "", profile: "User", active: true }
                    : { name: "", taxId: "", erpCode: "", active: true }
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
                bPerson = oRecord.getProperty("/kind") === "person",
                oValues = oRecord.getProperty("/values"),
                oBundle = this.getResourceBundle(),
                oKeys = bPerson ? adminRules.validatePerson(oValues) : adminRules.validateClient(oValues),
                oErrors = {},
                oBody = bPerson ? adminRules.personBody(oValues) : adminRules.clientBody(oValues);

            Object.keys(oKeys).forEach(function (sField) {
                oErrors[sField] = oBundle.getText(oKeys[sField]);
            });
            oRecord.setProperty("/errors", oErrors);
            if (Object.keys(oErrors).length) {
                return;
            }
            oRecord.setProperty("/busy", true);
            (oRecord.getProperty("/mode") === "create"
                ? this._createRecord(bPerson, oBody)
                : this._patchRecord(bPerson, this._oRecordRow,
                    adminRules.changes(this._oRecordRow, oBody, bPerson ? adminRules.PERSON_FIELDS : adminRules.CLIENT_FIELDS))
            ).then(function (bDone) {
                oRecord.setProperty("/busy", false);
                if (bDone) {
                    this.onCancelRecord();
                    this._onRecordsChanged("admSaved");
                }
            }.bind(this));
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
            var bPerson = this.getModel("dir").getProperty("/tab") === "pessoas";

            this._oRecordRow = oRow;
            this._openRecord({
                kind: bPerson ? "person" : "client",
                mode: "edit",
                title: this.getResourceBundle().getText(bPerson ? "admEditPerson" : "admEditClient", [oRow.name]),
                values: bPerson
                    ? { name: oRow.name, email: oRow.email, profile: oRow.profile, active: oRow.active !== false }
                    : { name: oRow.name, taxId: oRow.taxId || "", erpCode: oRow.erpCode || "", active: oRow.active !== false }
            });
        },

        /**
         * Desativar / Ativar: PATCH active.
         * @param {object} oRow the row
         * @param {boolean} bActive the new state
         * @private
         */
        _setActive: function (oRow, bActive) {
            var bPerson = this.getModel("dir").getProperty("/tab") === "pessoas";

            this._patchRecord(bPerson, oRow, { active: bActive }).then(function (bDone) {
                if (bDone) {
                    this._onRecordsChanged(bActive ? "admActivated" : "admDeactivated");
                }
            }.bind(this));
        },

        /**
         * Asks first, then DELETE. Who has history is refused (409) and
         * stays; the message says to deactivate instead.
         * @param {object} oRow the row
         * @private
         */
        _deleteRecord: function (oRow) {
            var bPerson = this.getModel("dir").getProperty("/tab") === "pessoas",
                oModel = this.getOwnerComponent().getModel("admin");

            MessageBox.confirm(this.getResourceBundle().getText("admDeleteConfirm", [oRow.name]), {
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    var oBinding, oContext;

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    oBinding = oModel.bindContext((bPerson ? "/People(" : "/Clients(") + oRow.ID + ")", undefined,
                        { $$updateGroupId: ADMIN_GROUP });
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
         * POST /admin/People or /admin/Clients.
         * @param {boolean} bPerson which
         * @param {object} oBody the record
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _createRecord: function (bPerson, oBody) {
            var oModel = this.getOwnerComponent().getModel("admin"),
                oBinding = oModel.bindList(bPerson ? "/People" : "/Clients", undefined, [], [], { $$updateGroupId: ADMIN_GROUP }),
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
         * PATCH /admin/People(<id>) or /admin/Clients(<id>) with the changes.
         * @param {boolean} bPerson which
         * @param {object} oRow the record as read
         * @param {object} oChanges the fields to change
         * @returns {Promise<boolean>} whether the API took it
         * @private
         */
        _patchRecord: function (bPerson, oRow, oChanges) {
            var oModel = this.getOwnerComponent().getModel("admin"),
                oBinding = oModel.bindContext((bPerson ? "/People(" : "/Clients(") + oRow.ID + ")", undefined,
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
    };
});
