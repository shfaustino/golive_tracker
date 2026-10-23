sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../service/childWrites"
], function (JSONModel, MessageToast, childWrites) {
    "use strict";

    /** SheetJS (webapp/thirdparty/sheetjs, Apache 2.0), loaded the first time an import needs it */
    var XLSX_MODULE = "com/amt/golivetracker/thirdparty/sheetjs/xlsx.mini.min";

    /**
     * Excel imports in the browser (Projetos, Pessoas, Clientes): a template
     * written and downloaded; a chosen file read into rows, each checked and
     * shown in the "import" model (state, and what is wrong); then the valid
     * ones created one POST after the other. Nothing is uploaded as a file.
     * Mixed into the page's controller.
     */
    return {

        /**
         * A fresh "import" model, for the dialog about to open.
         * @protected
         */
        resetImport: function () {
            if (!this.getModel("import")) {
                this.setModel(new JSONModel({}), "import");
            }
            this.getModel("import").setData({ busy: false, done: false, fileName: "", rows: [], ready: 0, wrong: 0 });
        },

        /**
         * Reads a chosen file and shows its rows, each ready or with its errors.
         * @param {File} oFile the file
         * @param {function(Array[]): object[]} fnRead the sheet into rows, each with errors
         *   [{field, key, value}] and, when it has none, its body in "body"
         * @param {Object<string, string>} mFieldLabels i18n key of each field's label
         * @protected
         */
        showImportFile: function (oFile, fnRead, mFieldLabels) {
            var oImport = this.getModel("import"),
                oBundle = this.getResourceBundle();

            oImport.setProperty("/busy", true);
            this.readExcel(oFile).then(fnRead).then(function (aRead) {
                var aRows = aRead.map(function (oRow) {
                    return Object.assign(oRow, {
                        state: oRow.errors.length ? "Error" : "Information",
                        stateText: oBundle.getText(oRow.errors.length ? "impWrong" : "impReady"),
                        message: oRow.errors.map(function (oError) {
                            return oBundle.getText(mFieldLabels[oError.field] || oError.field) + ": " +
                                oBundle.getText(oError.key, [oError.value]);
                        }).join("\n")
                    });
                });

                // merged, so what the page keeps in the model (Pessoas or Clientes) stays;
                // the rows emptied first, as a merge would mix them with the last file's
                oImport.setProperty("/rows", []);
                oImport.setData({
                    busy: false,
                    done: false,
                    fileName: oFile.name,
                    rows: aRows,
                    ready: aRows.filter(function (oRow) {
                        return !!oRow.body;
                    }).length,
                    wrong: aRows.filter(function (oRow) {
                        return !oRow.body;
                    }).length
                }, true);
            }).catch(function (oError) {
                oImport.setProperty("/busy", false);
                MessageToast.show(oBundle.getText("impUnreadable", [oError.message || String(oError)]));
            });
        },

        /**
         * Creates the ready rows, one POST after the other; each row then
         * says whether it was created or why the API refused it.
         * @param {sap.ui.model.odata.v4.ODataModel} oModel the service's model
         * @param {string} sPath the collection, e.g. /Projects
         * @param {function()} fnDone called at the end, to read the page again
         * @protected
         */
        createImportRows: function (oModel, sPath, fnDone) {
            var oImport = this.getModel("import"),
                oBundle = this.getResourceBundle(),
                iCreated = 0;

            oImport.setProperty("/busy", true);
            oImport.getProperty("/rows").reduce(function (pPrevious, oRow, i) {
                if (!oRow.body) {
                    return pPrevious;
                }
                return pPrevious.then(function () {
                    return childWrites.request(oModel, "POST", sPath, oRow.body);
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
                fnDone();
            });
        },

        /**
         * A workbook downloaded as a file.
         * @param {{name: string, rows: Array[]}[]} aSheets the sheets, a row per array
         * @param {string} sFileName the file's name
         * @returns {Promise} once it is written
         * @protected
         */
        writeExcel: function (aSheets, sFileName) {
            return this._loadXlsx().then(function (XLSX) {
                var oBook = XLSX.utils.book_new();

                aSheets.forEach(function (oSheet) {
                    XLSX.utils.book_append_sheet(oBook, XLSX.utils.aoa_to_sheet(oSheet.rows), oSheet.name);
                });
                XLSX.writeFile(oBook, sFileName);
            });
        },

        /**
         * The first sheet of a file, a row per array: dates as Dates, the
         * rest as written.
         * @param {File} oFile the chosen file (.xlsx, .xls, .csv)
         * @returns {Promise<Array[]>} the rows, the headers first
         * @protected
         */
        readExcel: function (oFile) {
            return Promise.all([this._loadXlsx(), oFile.arrayBuffer()]).then(function (aLoaded) {
                var XLSX = aLoaded[0],
                    oBook = XLSX.read(aLoaded[1], { cellDates: true });

                return XLSX.utils.sheet_to_json(oBook.Sheets[oBook.SheetNames[0]], { header: 1, raw: true, defval: "" });
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
        }
    };
});
