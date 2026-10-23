sap.ui.define([
    "./projectForm",
    "./sheetImport"
], function (projectForm, sheetImport) {
    "use strict";

    /**
     * The columns of the import template, in order: key in the form, header
     * in the sheet (* = required). The header is how a column is found, so
     * the columns may come in any order and the extra ones are ignored.
     */
    var COLUMNS = [
        ["code", "Código *"],
        ["name", "Nome *"],
        ["client", "Cliente * (nome ou NIF)"],
        ["projectType", "Tipo de projeto *"],
        ["startDate", "Data de início *"],
        ["endDate", "Data de fim *"],
        ["pm", "Gestor do projeto (email)"],
        ["modules", "Módulos (separados por vírgula)"],
        ["currency_code", "Moeda"],
        ["value", "Valor"],
        ["externalCode", "Código externo"],
        ["description", "Descrição"]
    ];

    /** Days from 1899-12-30 to 1970-01-01: Excel's serial dates */
    var EXCEL_EPOCH_DAYS = 25569;

    var text = sheetImport.text,
        same = sheetImport.same;

    /**
     * A date cell as YYYY-MM-DD: a Date, an Excel serial number, DD/MM/YYYY
     * (or with - or .) or YYYY-MM-DD.
     * @param {*} vValue the cell
     * @returns {string|null} the date, "" when empty, null when it is no date
     */
    function toDate(vValue) {
        var aParts, oUtc;

        if (vValue === null || vValue === undefined || vValue === "") {
            return "";
        }
        if (vValue instanceof Date) {
            // a date cell: midnight, local time
            oUtc = new Date(Date.UTC(vValue.getFullYear(), vValue.getMonth(), vValue.getDate()));
        } else if (typeof vValue === "number") {
            oUtc = new Date(Math.round(vValue - EXCEL_EPOCH_DAYS) * 86400000);
        } else if ((aParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(vValue)))) {
            oUtc = new Date(Date.UTC(+aParts[1], +aParts[2] - 1, +aParts[3]));
        } else if ((aParts = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text(vValue)))) {
            oUtc = new Date(Date.UTC(+aParts[3], +aParts[2] - 1, +aParts[1]));
        } else {
            return null;
        }
        return isNaN(oUtc.getTime()) ? null : oUtc.toISOString().slice(0, 10);
    }

    /**
     * What a row names that is not there: a client, a person, a project
     * type, a module, or a date that could not be read.
     * @param {{client: string, clientFound: boolean, pm: string, pmFound: boolean, type: string, modules: string[],
     *   startDate: (string|null), endDate: (string|null)}} oRow what the row says; a date, the text not understood
     * @param {string[]} aKnownModules the modules that can be chosen
     * @returns {{field: string, key: string, value: string}[]} the errors
     */
    function lookupErrors(oRow, aKnownModules) {
        var aErrors = [];

        if (oRow.client && !oRow.clientFound) {
            aErrors.push({ field: "client_ID", key: "impErrorClient", value: oRow.client });
        }
        ["startDate", "endDate"].forEach(function (sField) {
            if (oRow[sField] !== null) {
                aErrors.push({ field: sField, key: "impErrorDate", value: oRow[sField] });
            }
        });
        if (oRow.type && projectForm.PROJECT_TYPES.indexOf(oRow.type) === -1) {
            aErrors.push({ field: "projectType", key: "impErrorType", value: oRow.type });
        }
        if (oRow.pm && !oRow.pmFound) {
            aErrors.push({ field: "pm", key: "impErrorPerson", value: oRow.pm });
        }
        oRow.modules.filter(function (sModule) {
            return aKnownModules.indexOf(sModule) === -1;
        }).forEach(function (sModule) {
            aErrors.push({ field: "modules", key: "impErrorModule", value: sModule });
        });
        return aErrors;
    }

    return {

        COLUMNS: COLUMNS,

        toDate: toDate,

        /**
         * The template's rows: the headers, then one example.
         * @returns {Array[]} the rows
         */
        templateRows: function () {
            return [
                sheetImport.headers(COLUMNS),
                ["CO-N-0001", "Implementação SAP SuccessFactors", "[nome ou NIF do cliente]", "Implementation", "01/02/2027",
                    "30/11/2027", "[email do gestor]", "EC, ECP", "EUR", "", "", ""]
            ];
        },

        /**
         * Reads a sheet's rows into projects to create, each checked as the
         * Novo projeto form checks it, and against the clients, people and
         * project codes there are.
         * @param {Array[]} aSheet the sheet, a row per array, the headers first
         * @param {{clients: {ID: string, name: string, taxId: string}[], people: {ID: string, name: string, email: string}[],
         *   codes: string[], modules: string[]}} oKnown active clients and people, the codes already taken,
         *   and the modules that can be chosen (the active ones of the managed list)
         * @returns {{line: number, code: string, name: string, clientName: string, projectType: string,
         *   startDate: string, endDate: string, pmName: string, modules: string[], body: object,
         *   errors: {field: string, key: string, value: string}[]}[]} per filled row; errors use i18n keys
         */
        read: function (aSheet, oKnown) {
            var mCodes = sheetImport.taken(oKnown.codes);

            return sheetImport.rows(aSheet, COLUMNS).map(function (oRow) {
                var cell = oRow.cell,
                    aErrors = [],
                    sClient = text(cell("client")),
                    oClient = (oKnown.clients || []).filter(function (c) {
                        return same(c.name) === same(sClient) || (!!c.taxId && same(c.taxId) === same(sClient));
                    })[0],
                    sPm = text(cell("pm")),
                    oPm = sPm ? (oKnown.people || []).filter(function (p) {
                        return same(p.email) === same(sPm) || same(p.name) === same(sPm);
                    })[0] : null,
                    sStart = toDate(cell("startDate")),
                    sEnd = toDate(cell("endDate")),
                    sType = text(cell("projectType")),
                    aModules = text(cell("modules")).split(/[,;]/).map(text).filter(Boolean),
                    oValues = {
                        code: text(cell("code")),
                        name: text(cell("name")),
                        client_ID: oClient ? oClient.ID : "",
                        projectType: sType,
                        startDate: sStart || "",
                        endDate: sEnd || "",
                        currency_code: text(cell("currency_code")).toUpperCase() || "EUR",
                        value: text(cell("value")).replace(",", "."),
                        externalCode: text(cell("externalCode")),
                        description: text(cell("description")),
                        modules: aModules,
                        members: oPm ? [{ person_ID: oPm.ID, role: "PM" }] : []
                    },
                    oChecked = projectForm.validate(oValues);

                Object.keys(oChecked.fields).forEach(function (sField) {
                    // a client or a date that is there but was not understood says so below
                    if (!(sField === "client_ID" && sClient) && !(sField === "startDate" && sStart === null) &&
                            !(sField === "endDate" && sEnd === null)) {
                        aErrors.push({ field: sField, key: oChecked.fields[sField], value: "" });
                    }
                });
                aErrors = aErrors.concat(lookupErrors({
                    client: sClient, clientFound: !!oClient, pm: sPm, pmFound: !!oPm, type: sType, modules: aModules,
                    startDate: sStart === null ? text(cell("startDate")) : null,
                    endDate: sEnd === null ? text(cell("endDate")) : null
                }, oKnown.modules || []), sheetImport.uniqueErrors(oValues.code, mCodes, "code", "impErrorCodeTaken", "impErrorCodeRepeated"));

                return {
                    line: oRow.line,
                    code: oValues.code,
                    name: oValues.name,
                    clientName: oClient ? oClient.name : sClient,
                    projectType: sType,
                    startDate: oValues.startDate,
                    endDate: oValues.endDate,
                    pmName: oPm ? oPm.name : sPm,
                    modules: aModules,
                    body: aErrors.length ? null : projectForm.payload(oValues),
                    errors: aErrors
                };
            });
        }
    };
});
