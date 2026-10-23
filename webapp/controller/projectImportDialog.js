sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/base/strings/formatMessage",
    "../model/projectImport",
    "../model/projectForm",
    "../service/childWrites"
], function (JSONModel, MessageToast, formatMessage, projectImport, projectForm, childWrites) {
    "use strict";

    /** SheetJS (webapp/thirdparty/sheetjs, Apache 2.0), loaded the first time an import needs it */
    var XLSX_MODULE = "com/amt/golivetracker/thirdparty/sheetjs/xlsx.mini.min";

    /** The label of each field an error names */
    var FIELD_LABELS = {
        code: "colCode", name: "colName", client_ID: "colClient", projectType: "projectType",
        startDate: "projectStartDate", endDate: "projectEndDate", currency_code: "projectCurrency",
        value: "projectValue", pm: "projectPm", modules: "tabModules"
    };

    /**
     * Importar projetos, on the Projetos page: an Excel template to fill
     * in, then the filled file read in the browser (SheetJS), every row
     * checked (model/projectImport.js) and shown before anything is sent,
     * and the valid ones created one by one with the same deep insert as
     * Novo projeto. Mixed into Projects.controller.js, so `this` is that
     * controller; it implements _load(iPage).
     */
    return {

        /**
         * A text of the dialog with its numbers in (the summary, the button).
         * @param {string} sPattern the i18n text, with {0}, {1}
         * @returns {string} the text
         * @public
         */
        formatMessage: function (sPattern) {
            return sPattern ? formatMessage(sPattern, Array.prototype.slice.call(arguments, 1)) : "";
        },

        /** @public */
        onImportProjects: function () {
            if (!this.getModel("import")) {
                this.setModel(new JSONModel({}), "import");
            }
            this.getModel("import").setData({ busy: false, done: false, fileName: "", rows: [], ready: 0, wrong: 0 });
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
            Promise.all([this._loadXlsx(), this._pImportKnown]).then(function (aLoaded) {
                var XLSX = aLoaded[0],
                    oKnown = aLoaded[1],
                    oBook = XLSX.utils.book_new(),
                    iRows = Math.max(projectForm.PROJECT_TYPES.length, projectForm.MODULES.length,
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
                XLSX.utils.book_append_sheet(oBook, XLSX.utils.aoa_to_sheet(projectImport.templateRows()), "Projetos");
                XLSX.utils.book_append_sheet(oBook, XLSX.utils.aoa_to_sheet(aLists), "Listas");
                XLSX.writeFile(oBook, "modelo-importar-projetos.xlsx");
            });
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
                this._readImportFile(aFiles[0]);
            }
            // the same file can be chosen again after it was fixed
            oEvent.getSource().clear();
        },

        /**
         * Criar: the valid rows, one POST /Projects each, in order; each row
         * then says whether it was created or why the API refused it.
         * @public
         */
        onConfirmImport: function () {
            var oImport = this.getModel("import"),
                oModel = this.getOwnerComponent().getModel(),
                oBundle = this.getResourceBundle(),
                aRows = oImport.getProperty("/rows"),
                iCreated = 0;

            oImport.setProperty("/busy", true);
            aRows.reduce(function (pPrevious, oRow, i) {
                if (!oRow.payload) {
                    return pPrevious;
                }
                return pPrevious.then(function () {
                    return childWrites.request(oModel, "POST", "/Projects", oRow.payload);
                }).then(function (oResult) {
                    iCreated += oResult.ok ? 1 : 0;
                    oImport.setProperty("/rows/" + i + "/state", oResult.ok ? "Success" : "Error");
                    oImport.setProperty("/rows/" + i + "/stateText", oBundle.getText(oResult.ok ? "impCreated" : "impFailed"));
                    oImport.setProperty("/rows/" + i + "/message", oResult.message);
                });
            }, Promise.resolve()).then(function () {
                oImport.setProperty("/busy", false);
                oImport.setProperty("/done", true);
                MessageToast.show(oBundle.getText("impDone", [iCreated]));
                this._load(1);
            }.bind(this));
        },

        /** @public */
        onCloseImport: function () {
            this._getImportDialog().then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * @param {File} oFile the chosen file
         * @private
         */
        _readImportFile: function (oFile) {
            var oImport = this.getModel("import"),
                oBundle = this.getResourceBundle();

            oImport.setProperty("/busy", true);
            Promise.all([this._loadXlsx(), this._pImportKnown, oFile.arrayBuffer()]).then(function (aLoaded) {
                var XLSX = aLoaded[0],
                    oBook = XLSX.read(aLoaded[2], { cellDates: true }),
                    aSheet = XLSX.utils.sheet_to_json(oBook.Sheets[oBook.SheetNames[0]], { header: 1, raw: true, defval: "" }),
                    aRows = projectImport.read(aSheet, aLoaded[1]).map(function (oRow) {
                        return Object.assign(oRow, {
                            state: oRow.errors.length ? "Error" : "Information",
                            stateText: oBundle.getText(oRow.errors.length ? "impWrong" : "impReady"),
                            message: oRow.errors.map(function (oError) {
                                var sLabel = oBundle.getText(FIELD_LABELS[oError.field] || oError.field);

                                return sLabel + ": " + oBundle.getText(oError.key, [oError.value]);
                            }).join("\n")
                        });
                    });

                oImport.setData({
                    busy: false,
                    done: false,
                    fileName: oFile.name,
                    rows: aRows,
                    ready: aRows.filter(function (oRow) {
                        return !!oRow.payload;
                    }).length,
                    wrong: aRows.filter(function (oRow) {
                        return !oRow.payload;
                    }).length
                });
            }).catch(function (oError) {
                oImport.setProperty("/busy", false);
                MessageToast.show(oBundle.getText("impUnreadable", [oError.message || String(oError)]));
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

        /**
         * @returns {Promise<object>} SheetJS's XLSX
         * @private
         */
        _loadXlsx: function () {
            var mShim = {};

            if (!this._pXlsx) {
                // a plain script that sets window.XLSX
                mShim[XLSX_MODULE] = { amd: false, exports: "XLSX" };
                sap.ui.loader.config({ shim: mShim });
                this._pXlsx = new Promise(function (fnResolve, fnReject) {
                    sap.ui.require([XLSX_MODULE], fnResolve, fnReject);
                });
            }
            return this._pXlsx;
        },

        /** @private */
        _getImportDialog: function () {
            if (!this._pImportDialog) {
                this._pImportDialog = this.loadFragment({ name: "com.amt.golivetracker.fragment.ProjectImportDialog" });
            }
            return this._pImportDialog;
        }
    };
});
