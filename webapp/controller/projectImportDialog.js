sap.ui.define([
    "../model/projectImport",
    "../model/projectForm",
    "./excelFiles"
], function (projectImport, projectForm, excelFiles) {
    "use strict";

    /** The label of each field an error names */
    var FIELD_LABELS = {
        code: "colCode", name: "colName", client_ID: "colClient", projectType: "projectType",
        startDate: "projectStartDate", endDate: "projectEndDate", currency_code: "projectCurrency",
        value: "projectValue", pm: "projectPm", modules: "tabModules"
    };

    /**
     * Importar projetos, on the Projetos page: an Excel template to fill
     * in, then the filled file read in the browser (./excelFiles), every row
     * checked (model/projectImport.js) and shown before anything is sent,
     * and the valid ones created one by one with the same deep insert as
     * Novo projeto. Mixed into Projects.controller.js, so `this` is that
     * controller; it implements _load(iPage).
     */
    return Object.assign({}, excelFiles, {

        /** @public */
        onImportProjects: function () {
            this.resetImport();
            this._pImportKnown = this._readImportKnown();
            this._getImportDialog().then(function (oDialog) {
                oDialog.open();
            });
        },

        /**
         * The template: the columns and an example, and a second sheet with
         * what the columns take (project types, modules, clients, people).
         * @public
         */
        onDownloadImportTemplate: function () {
            this._pImportKnown.then(function (oKnown) {
                var iRows = Math.max(projectForm.PROJECT_TYPES.length, projectForm.MODULES.length,
                        oKnown.clients.length, oKnown.people.length),
                    aLists = [["Tipo de projeto", "Módulos", "Clientes", "Pessoas (email)"]],
                    i;

                for (i = 0; i < iRows; i++) {
                    aLists.push([
                        projectForm.PROJECT_TYPES[i] || "",
                        projectForm.MODULES[i] || "",
                        oKnown.clients[i] ? oKnown.clients[i].name : "",
                        oKnown.people[i] ? oKnown.people[i].email : ""
                    ]);
                }
                return this.writeExcel([
                    { name: "Projetos", rows: projectImport.templateRows() },
                    { name: "Listas", rows: aLists }
                ], "modelo-importar-projetos.xlsx");
            }.bind(this));
        },

        /**
         * Escolher ficheiro (a FileUploader that only picks): the file is read
         * here, nothing is sent yet.
         * @param {sap.ui.base.Event} oEvent change of the FileUploader
         * @public
         */
        onChooseImportFile: function (oEvent) {
            var aFiles = oEvent.getParameter("files");

            if (aFiles && aFiles[0]) {
                this._pImportKnown.then(function (oKnown) {
                    this.showImportFile(aFiles[0], function (aSheet) {
                        return projectImport.read(aSheet, oKnown);
                    }, FIELD_LABELS);
                }.bind(this));
            }
            // the same file can be chosen again after it was fixed
            oEvent.getSource().clear();
        },

        /**
         * Criar: the valid rows, one POST /Projects each.
         * @public
         */
        onConfirmImport: function () {
            this.createImportRows(this.getOwnerComponent().getModel(), "/Projects", this._load.bind(this, 1));
        },

        /** @public */
        onCloseImport: function () {
            this._getImportDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * What the rows are checked against: the active clients and people,
         * and the project codes the user can see (the API refuses the rest, 409).
         * @returns {Promise<{clients: object[], people: object[], codes: string[]}>} them
         * @private
         */
        _readImportKnown: function () {
            var read = function (sPath, mParameters) {
                var oBinding = this.getOwnerComponent().getModel().bindList(sPath, undefined, [], [], mParameters);

                return oBinding.requestContexts(0, 5000).then(function (aContexts) {
                    return aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });
                }).catch(function () {
                    return [];
                }).finally(function () {
                    oBinding.destroy();
                });
            }.bind(this);

            return Promise.all([
                read("/Clients", { $select: "ID,name,taxId", $orderby: "name" }),
                read("/People", { $select: "ID,name,email", $orderby: "name" }),
                read("/Projects", { $select: "ID,code" })
            ]).then(function (aResults) {
                return {
                    clients: aResults[0],
                    people: aResults[1],
                    codes: aResults[2].map(function (oProject) {
                        return oProject.code;
                    })
                };
            });
        },

        /** @private */
        _getImportDialog: function () {
            if (!this._pImportDialog) {
                this._pImportDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.ProjectImportDialog" });
            }
            return this._pImportDialog;
        }
    });
});
