sap.ui.define([
    "./adminRules",
    "./sheetImport"
], function (adminRules, sheetImport) {
    "use strict";

    var text = sheetImport.text;

    /** The columns of each template (* = required); found by their header, as for projects */
    var COLUMNS = {
        person: [["name", "Nome *"], ["email", "Email *"], ["profile", "Perfil (Administrador, Arquiteto ou Utilizador)"]],
        client: [["name", "Nome *"], ["taxId", "NIF"], ["erpCode", "Código ERP"]]
    };

    /** A profile as it may be written in the sheet, in Portuguese or as the API names it */
    var PROFILES = {
        administrador: "Administrator", administrator: "Administrator", admin: "Administrator",
        arquiteto: "Architect", architect: "Architect",
        utilizador: "User", user: "User"
    };

    /** An example row of each template */
    var EXAMPLES = {
        person: ["Ana Silva", "ana.silva@amt-consulting.com", "Utilizador"],
        client: ["Cliente Exemplo, S.A.", "500100200", "ERP-0001"]
    };

    /**
     * @param {Object<string, string>} oKeys per field, the i18n key of what is wrong (adminRules)
     * @returns {{field: string, key: string, value: string}[]} as a list
     */
    function errorsOf(oKeys) {
        return Object.keys(oKeys).map(function (sField) {
            return { field: sField, key: oKeys[sField], value: "" };
        });
    }

    /**
     * A person's row: its form values and what is wrong with them.
     * @param {function(string): *} cell the row's cells by column
     * @param {Object<string, Object<string, string>>} mSeen emails seen
     * @returns {{values: object, errors: object[], detail: string, extra: string}} the row
     */
    function readPerson(cell, mSeen) {
        var sProfile = text(cell("profile")),
            sMapped = sProfile ? PROFILES[sheetImport.same(sProfile)] : "User",
            oValues = { name: text(cell("name")), email: text(cell("email")).toLowerCase(), profile: sMapped || "", active: true },
            aErrors = [];

        if (sProfile && !sMapped) {
            aErrors.push({ field: "profile", key: "impErrorProfile", value: sProfile });
            oValues.profile = "User";
        }
        aErrors = aErrors.concat(errorsOf(adminRules.validatePerson(oValues)),
            sheetImport.uniqueErrors(oValues.email, mSeen.email, "email", "impErrorEmailTaken", "impErrorEmailRepeated"));
        return {
            values: oValues,
            errors: aErrors,
            detail: oValues.email,
            extra: sMapped || sProfile,
            body: aErrors.length ? null : adminRules.personBody(oValues)
        };
    }

    /**
     * A client's row: its form values and what is wrong with them.
     * @param {function(string): *} cell the row's cells by column
     * @param {Object<string, Object<string, string>>} mSeen names and NIFs seen
     * @returns {{values: object, errors: object[], detail: string, extra: string}} the row
     */
    function readClient(cell, mSeen) {
        var oValues = { name: text(cell("name")), taxId: text(cell("taxId")), erpCode: text(cell("erpCode")), active: true },
            aErrors = errorsOf(adminRules.validateClient(oValues)).concat(
                sheetImport.uniqueErrors(oValues.name, mSeen.name, "name", "impErrorNameTaken", "impErrorNameRepeated"),
                sheetImport.uniqueErrors(oValues.taxId, mSeen.taxId, "taxId", "impErrorTaxIdTaken", "impErrorTaxIdRepeated"));

        return {
            values: oValues,
            errors: aErrors,
            detail: oValues.taxId,
            extra: oValues.erpCode,
            body: aErrors.length ? null : adminRules.clientBody(oValues)
        };
    }

    return {

        COLUMNS: COLUMNS,

        /**
         * A template's rows: the headers, then one example.
         * @param {string} sKind "person" or "client"
         * @returns {Array[]} the rows
         */
        templateRows: function (sKind) {
            return [sheetImport.headers(COLUMNS[sKind]), EXAMPLES[sKind]];
        },

        /**
         * Reads a sheet's rows into people or clients to create, each checked
         * as Nova pessoa / Novo cliente checks it, and against the emails,
         * names and NIFs there are (the API refuses a repeated one, 409).
         * @param {Array[]} aSheet the sheet, the headers first
         * @param {string} sKind "person" or "client"
         * @param {{emails: string[], names: string[], taxIds: string[]}} oKnown what is already there
         * @returns {{line: number, name: string, detail: string, extra: string, body: (object|null),
         *   errors: {field: string, key: string, value: string}[]}[]} per filled row; errors use i18n keys
         */
        read: function (aSheet, sKind, oKnown) {
            var mSeen = {
                email: sheetImport.taken(oKnown.emails),
                name: sheetImport.taken(oKnown.names),
                taxId: sheetImport.taken(oKnown.taxIds)
            };

            return sheetImport.rows(aSheet, COLUMNS[sKind]).map(function (oRow) {
                var oRead = sKind === "person" ? readPerson(oRow.cell, mSeen) : readClient(oRow.cell, mSeen);

                return {
                    line: oRow.line,
                    name: oRead.values.name,
                    detail: oRead.detail,
                    extra: oRead.extra,
                    errors: oRead.errors,
                    body: oRead.body
                };
            });
        }
    };
});
