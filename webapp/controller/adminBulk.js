sap.ui.define([
    "../model/adminImport",
    "./excelFiles",
    "./bulkDelete"
], function (adminImport, excelFiles, bulkDelete) {
    "use strict";

    /** The label of each field an import error names */
    var FIELD_LABELS = { name: "admName", email: "admEmail", profile: "teamColProfile", taxId: "admTaxId", erpCode: "admErpCode" };

    /**
     * Pessoas and Clientes many at a time, for Administrators, through
     * /admin: Importar (an Excel template, the file read in the browser, the
     * valid rows created; ./excelFiles) and Eliminar selecionados
     * (./bulkDelete; who has project history cannot be deleted, 409, and
     * can be deactivated instead). Mixed into Admin.controller.js through
     * ./adminActions; the tab on show (dir>/tab) says which.
     */
    return Object.assign({}, excelFiles, bulkDelete, {

        /** @public */
        onImportRecords: function () {
            var bPeople = this._isPeopleTab();

            this.resetImport();
            this.getModel("import").setProperty("/kind", bPeople ? "person" : "client");
            this._pRecordsKnown = this._readRecordsKnown(bPeople);
            this._getRecordsImportDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /** @public */
        onDownloadRecordsTemplate: function () {
            var bPeople = this._isPeopleTab();

            this.writeExcel([{ name: bPeople ? "Pessoas" : "Clientes", rows: adminImport.templateRows(bPeople ? "person" : "client") }],
                bPeople ? "modelo-importar-pessoas.xlsx" : "modelo-importar-clientes.xlsx");
        },

        /**
         * @param {sap.ui.base.Event} oEvent change of the FileUploader
         * @public
         */
        onChooseRecordsFile: function (oEvent) {
            var aFiles = oEvent.getParameter("files"),
                sKind = this._isPeopleTab() ? "person" : "client";

            if (aFiles && aFiles[0]) {
                this._pRecordsKnown.then(function (oKnown) {
                    this.showImportFile(aFiles[0], function (aSheet) {
                        return adminImport.read(aSheet, sKind, oKnown);
                    }, FIELD_LABELS);
                }.bind(this));
            }
            oEvent.getSource().clear();
        },

        /** @public */
        onConfirmRecordsImport: function () {
            this.createImportRows(this.getOwnerComponent().getModel("admin"), this._isPeopleTab() ? "/People" : "/Clients",
                this._load.bind(this, 1));
        },

        /** @public */
        onCloseRecordsImport: function () {
            this._getRecordsImportDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * What ./bulkDelete works with on this page: the tab's table and /admin.
         * @returns {object} the setup
         * @private
         */
        _bulkSetup: function () {
            var oBundle = this.getResourceBundle(),
                oDir = this.getModel("dir"),
                bPeople = this._isPeopleTab();

            return {
                table: this.byId(bPeople ? "peopleTable" : "clientsTable"),
                rowModel: "dir",
                model: this.getOwnerComponent().getModel("admin"),
                canDeactivate: true,
                texts: {
                    title: oBundle.getText(bPeople ? "bulkTitlePeople" : "bulkTitleClients"),
                    intro: oBundle.getText(bPeople ? "bulkIntroPeople" : "bulkIntroClients"),
                    codeLabel: oBundle.getText(bPeople ? "admEmail" : "admTaxId")
                },
                row: function (oRecord) {
                    return { ID: oRecord.ID, code: bPeople ? oRecord.email : oRecord.taxId, name: oRecord.name };
                },
                path: function (oRow) {
                    return (bPeople ? "/People(" : "/Clients(") + oRow.ID + ")";
                },
                setCount: function (iCount) {
                    oDir.setProperty("/selectedCount", iCount);
                },
                done: function () {
                    this._load(oDir.getProperty("/page"));
                }.bind(this)
            };
        },

        /**
         * What the rows are checked against: every email, or every client's
         * name and NIF, inactive ones too (the API keeps them unique).
         * @param {boolean} bPeople people or clients
         * @returns {Promise<{emails: string[], names: string[], taxIds: string[]}>} them
         * @private
         */
        _readRecordsKnown: function (bPeople) {
            var oBinding = this.getOwnerComponent().getModel("admin").bindList(bPeople ? "/People" : "/Clients", undefined, [], [],
                { $select: bPeople ? "ID,email" : "ID,name,taxId" });

            return oBinding.requestContexts(0, 5000).then(function (aContexts) {
                var aRecords = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });

                return {
                    emails: aRecords.map(function (o) {
                        return o.email;
                    }),
                    names: aRecords.map(function (o) {
                        return o.name;
                    }),
                    taxIds: aRecords.map(function (o) {
                        return o.taxId;
                    })
                };
            }).catch(function () {
                return { emails: [], names: [], taxIds: [] };
            }).finally(function () {
                oBinding.destroy();
            });
        },

        /**
         * @returns {boolean} whether Pessoas is on show (else Clientes)
         * @private
         */
        _isPeopleTab: function () {
            return this.getModel("dir").getProperty("/tab") === "pessoas";
        },

        /** @private */
        _getRecordsImportDialog: function () {
            if (!this._pRecordsImportDialog) {
                this._pRecordsImportDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.AdminImportDialog" });
            }
            return this._pRecordsImportDialog;
        }
    });
});
