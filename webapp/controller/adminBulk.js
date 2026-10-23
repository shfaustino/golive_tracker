sap.ui.define([
    "../model/adminImport",
    "../model/adminTabs",
    "./excelFiles",
    "./bulkDelete"
], function (adminImport, adminTabs, excelFiles, bulkDelete) {
    "use strict";

    /** The label of each field an import error names */
    var FIELD_LABELS = {
        name: "admName", email: "admEmail", profile: "teamColProfile", taxId: "admTaxId", erpCode: "admErpCode",
        code: "admCode", sortOrder: "admOrder", requiresAudit: "admRequiresAudit"
    };

    /** The template file of each kind of record */
    var TEMPLATE_FILES = {
        person: ["Pessoas", "modelo-importar-pessoas.xlsx"],
        client: ["Clientes", "modelo-importar-clientes.xlsx"],
        module: ["Modulos", "modelo-importar-modulos.xlsx"],
        milestoneType: ["Tipos de marco", "modelo-importar-tipos-de-marco.xlsx"]
    };

    /**
     * The tab on show (Pessoas, Clientes, Módulos, Tipos de marco;
     * model/adminTabs.js) many at a time, for Administrators, through /admin:
     * Importar (an Excel template, the file read in the browser, the valid
     * rows created; ./excelFiles) and Eliminar selecionados (./bulkDelete;
     * what is in use cannot be deleted, 409, and can be deactivated
     * instead). Mixed into Admin.controller.js through ./adminActions.
     */
    return Object.assign({}, excelFiles, bulkDelete, {

        /** @public */
        onImportRecords: function () {
            var oTab = this._tab(),
                oBundle = this.getResourceBundle();

            this.resetImport();
            this.getModel("import").setData({
                kind: oTab.kind,
                title: oBundle.getText(oTab.texts.importTitle),
                intro: oBundle.getText(oTab.texts.importIntro),
                detailLabel: oBundle.getText(oTab.kind === "module" || oTab.kind === "milestoneType" ? "admCode" : oTab.texts.codeLabel),
                extraLabel: oTab.texts.extraLabel ? oBundle.getText(oTab.texts.extraLabel) : ""
            }, true);
            this._pRecordsKnown = this._readRecordsKnown(oTab);
            this._getRecordsImportDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /** @public */
        onDownloadRecordsTemplate: function () {
            var sKind = this._tab().kind;

            this.writeExcel([{ name: TEMPLATE_FILES[sKind][0], rows: adminImport.templateRows(sKind) }], TEMPLATE_FILES[sKind][1]);
        },

        /**
         * @param {sap.ui.base.Event} oEvent change of the FileUploader
         * @public
         */
        onChooseRecordsFile: function (oEvent) {
            var aFiles = oEvent.getParameter("files"),
                sKind = this._tab().kind;

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
            this.createImportRows(this.getOwnerComponent().getModel("admin"), "/" + this._tab().set, function () {
                this._load(1);
                this._reloadListsIfManaged();
            }.bind(this));
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
                sTab = oDir.getProperty("/tab"),
                oTab = adminTabs.of(sTab);

            return {
                table: this.byId(oTab.table),
                rowModel: "dir",
                model: this.getOwnerComponent().getModel("admin"),
                canDeactivate: true,
                texts: {
                    title: oBundle.getText(oTab.texts.bulkTitle),
                    intro: oBundle.getText(oTab.texts.bulkIntro),
                    codeLabel: oBundle.getText(oTab.texts.codeLabel)
                },
                row: function (oRecord) {
                    return Object.assign({ code: oRecord[oTab.code], name: oRecord.name }, oRecord);
                },
                path: function (oRow) {
                    return adminTabs.path(sTab, oRow);
                },
                setCount: function (iCount) {
                    oDir.setProperty("/selectedCount", iCount);
                },
                done: function () {
                    this._load(oDir.getProperty("/page"));
                    this._reloadListsIfManaged();
                }.bind(this)
            };
        },

        /**
         * What the rows are checked against: every email, every client's name
         * and NIF, every code, inactive ones too (the API keeps them unique).
         * @param {object} oTab the tab (model/adminTabs.js)
         * @returns {Promise<{emails: string[], names: string[], taxIds: string[], codes: string[]}>} them
         * @private
         */
        _readRecordsKnown: function (oTab) {
            var oBinding = this.getOwnerComponent().getModel("admin").bindList("/" + oTab.set, undefined, [], [], { $select: oTab.select });

            return oBinding.requestContexts(0, 5000).then(function (aContexts) {
                var aRecords = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    }),
                    pluck = function (sField) {
                        return aRecords.map(function (o) {
                            return o[sField];
                        });
                    };

                return { emails: pluck("email"), names: pluck("name"), taxIds: pluck("taxId"), codes: pluck("code") };
            }).catch(function () {
                return { emails: [], names: [], taxIds: [], codes: [] };
            }).finally(function () {
                oBinding.destroy();
            });
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
